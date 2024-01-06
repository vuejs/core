import type { Scheduler } from '@vue/reactivity'
import type { ComponentInternalInstance } from './component'

export interface SchedulerJob extends Function {
  id?: number
  pre?: boolean
  active?: boolean
  computed?: boolean
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
  allowRecurse?: boolean
  /**
   * Attached by renderer.ts when setting up a component's render effect
   * Used to obtain component information when reporting max recursive updates.
   * dev only.
   */
  ownerInstance?: ComponentInternalInstance
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

function queueJob(job: SchedulerJob) {
  if (
    !queue.length ||
    !queue.includes(
      job,
      isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex,
    )
  ) {
    if (job.id == null) {
      queue.push(job)
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job)
    }
    queueFlush()
  }
}

export function queuePostRenderEffect(cb: SchedulerJob) {
  if (
    !activePostFlushCbs ||
    !activePostFlushCbs.includes(
      cb,
      cb.allowRecurse ? postFlushIndex + 1 : postFlushIndex,
    )
  ) {
    pendingPostFlushCbs.push(cb)
  }
  queueFlush()
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}

function flushPostFlushCbs() {
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
  }
  activePostFlushCbs = null
  postFlushIndex = 0
}

// TODO: dev mode and checkRecursiveUpdates
function flushJobs() {
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
      queue![i]()
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
    if (middleJobId < id || (middleJobId === id && middleJob.pre)) {
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
    if (a.pre && !b.pre) return -1
    if (b.pre && !a.pre) return 1
  }
  return diff
}

export type SchedulerFactory = (
  instance: ComponentInternalInstance | null,
) => Scheduler

export const createVaporSyncScheduler: SchedulerFactory =
  (instance) => (job, effect, isInit) => {
    if (isInit) {
      effect.run()
    } else {
      job()
    }
  }

export const createVaporPreScheduler: SchedulerFactory =
  (instance) => (job, effect, isInit) => {
    if (isInit) {
      effect.run()
    } else {
      job.pre = true
      if (instance) job.id = instance.uid
      queueJob(job)
    }
  }

export const createVaporRenderingScheduler: SchedulerFactory =
  (instance) => (job, effect, isInit) => {
    if (isInit) {
      effect.run()
    } else {
      job.pre = false
      if (instance) job.id = instance.uid
      queueJob(job)
    }
  }

export const createVaporPostScheduler: SchedulerFactory =
  (instance) => (job, effect, isInit) => {
    if (isInit) {
      queuePostRenderEffect(effect.run.bind(effect))
    } else {
      queuePostRenderEffect(job)
    }
  }
