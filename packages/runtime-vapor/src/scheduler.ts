import type { WatchScheduler } from '@vue/reactivity'
import type { ComponentInternalInstance } from './component'
import { isArray } from '@vue/shared'

export enum VaporSchedulerJobFlags {
  QUEUED = 1 << 0,
  PRE = 1 << 1,
  /**
   * Indicates whether the effect is allowed to recursively trigger itself
   * when managed by the scheduler.
   *
   * By default, a job cannot trigger itself because some built-in method calls,
   * e.g. Array.prototype.push actually performs reads as well (#1740) which
   * can lead to confusing infinite loops.
   * The allowed cases are component update functions and watch callbacks.
   * Component update functions may update child component props, which in turn
   * trigger flush: "pre" watch callbacks that mutates state that the parent
   * relies on (#1801). Watch callbacks doesn't track its dependencies so if it
   * triggers itself again, it's likely intentional and it is the user's
   * responsibility to perform recursive state mutation that eventually
   * stabilizes (#1727).
   */
  ALLOW_RECURSE = 1 << 2,
  DISPOSED = 1 << 3,
}

export interface SchedulerJob extends Function {
  id?: number
  /**
   * flags can technically be undefined, but it can still be used in bitwise
   * operations just like 0.
   */
  flags?: VaporSchedulerJobFlags
  /**
   * Attached by renderer.ts when setting up a component's render effect
   * Used to obtain component information when reporting max recursive updates.
   */
  i?: ComponentInternalInstance
}

export type SchedulerJobs = SchedulerJob | SchedulerJob[]
export type QueueEffect = (
  cb: SchedulerJobs,
  suspense: ComponentInternalInstance | null,
) => void

let isFlushing = false
let isFlushPending = false

// TODO: The queues in Vapor need to be merged with the queues in Core.
//       this is a temporary solution, the ultimate goal is to support
//       the mixed use of vapor components and default components.
const queue: SchedulerJob[] = []
let flushIndex = 0

// TODO: The queues in Vapor need to be merged with the queues in Core.
//       this is a temporary solution, the ultimate goal is to support
//       the mixed use of vapor components and default components.
const pendingPostFlushCbs: SchedulerJob[] = []
let activePostFlushCbs: SchedulerJob[] | null = null
let postFlushIndex = 0

const resolvedPromise = /*#__PURE__*/ Promise.resolve() as Promise<any>
let currentFlushPromise: Promise<void> | null = null

export function queueJob(job: SchedulerJob): void {
  let lastOne: SchedulerJob | undefined
  if (!(job.flags! & VaporSchedulerJobFlags.QUEUED)) {
    if (job.id == null) {
      queue.push(job)
    } else if (
      // fast path when the job id is larger than the tail
      !(job.flags! & VaporSchedulerJobFlags.PRE) &&
      job.id >= (((lastOne = queue[queue.length - 1]) && lastOne.id) || 0)
    ) {
      queue.push(job)
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job)
    }

    if (!(job.flags! & VaporSchedulerJobFlags.ALLOW_RECURSE)) {
      job.flags! |= VaporSchedulerJobFlags.QUEUED
    }
    queueFlush()
  }
}

export function queuePostFlushCb(cb: SchedulerJobs): void {
  if (!isArray(cb)) {
    if (!(cb.flags! & VaporSchedulerJobFlags.QUEUED)) {
      pendingPostFlushCbs.push(cb)
      if (!(cb.flags! & VaporSchedulerJobFlags.ALLOW_RECURSE)) {
        cb.flags! |= VaporSchedulerJobFlags.QUEUED
      }
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip duplicate check here to improve perf
    pendingPostFlushCbs.push(...cb)
  }
  queueFlush()
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}

export function flushPostFlushCbs(): void {
  if (!pendingPostFlushCbs.length) return

  const deduped = [...new Set(pendingPostFlushCbs)]
  pendingPostFlushCbs.length = 0

  // #1947 already has active queue, nested flushPostFlushCbs call
  if (activePostFlushCbs) {
    activePostFlushCbs.push(...deduped)
    return
  }

  activePostFlushCbs = deduped

  activePostFlushCbs.sort((a, b) => getId(a) - getId(b))

  for (
    postFlushIndex = 0;
    postFlushIndex < activePostFlushCbs.length;
    postFlushIndex++
  ) {
    activePostFlushCbs[postFlushIndex]()
    activePostFlushCbs[postFlushIndex].flags! &= ~VaporSchedulerJobFlags.QUEUED
  }
  activePostFlushCbs = null
  postFlushIndex = 0
}

// TODO: dev mode and checkRecursiveUpdates
function flushJobs() {
  if (__BENCHMARK__) performance.mark('flushJobs-start')
  isFlushPending = false
  isFlushing = true

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child so its render effect will have smaller
  //    priority number)
  // 2. If a component is unmounted during a parent component's update,
  //    its update can be skipped.
  queue.sort(comparator)

  try {
    for (let i = 0; i < queue!.length; i++) {
      queue[i]()
      queue[i].flags! &= ~VaporSchedulerJobFlags.QUEUED
    }
  } finally {
    flushIndex = 0
    queue.length = 0

    flushPostFlushCbs()

    isFlushing = false
    currentFlushPromise = null
    // some postFlushCb queued jobs!
    // keep flushing until it drains.
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs()
    }
    if (__BENCHMARK__) performance.mark('flushJobs-end')
  }
}

export function nextTick<T = void, R = void>(
  this: T,
  fn?: (this: T) => R,
): Promise<Awaited<R>> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}

// #2768
// Use binary-search to find a suitable position in the queue,
// so that the queue maintains the increasing order of job's id,
// which can prevent the job from being skipped and also can avoid repeated patching.
function findInsertionIndex(id: number) {
  // the start index should be `flushIndex + 1`
  let start = flushIndex + 1
  let end = queue.length

  while (start < end) {
    const middle = (start + end) >>> 1
    const middleJob = queue[middle]
    const middleJobId = getId(middleJob)
    if (
      middleJobId < id ||
      (middleJobId === id && middleJob.flags! & VaporSchedulerJobFlags.PRE)
    ) {
      start = middle + 1
    } else {
      end = middle
    }
  }

  return start
}

const getId = (job: SchedulerJob): number =>
  job.id == null ? Infinity : job.id

const comparator = (a: SchedulerJob, b: SchedulerJob): number => {
  const diff = getId(a) - getId(b)
  if (diff === 0) {
    const isAPre = a.flags! & VaporSchedulerJobFlags.PRE
    const isBPre = b.flags! & VaporSchedulerJobFlags.PRE
    if (isAPre && !isBPre) return -1
    if (isBPre && !isAPre) return 1
  }
  return diff
}

export type SchedulerFactory = (
  instance: ComponentInternalInstance | null,
) => WatchScheduler
