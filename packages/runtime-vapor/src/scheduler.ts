import {
  EffectFlags,
  type SchedulerJob,
  SchedulerJobFlags,
  type WatchScheduler,
} from '@vue/reactivity'
import type { ComponentInternalInstance } from './component'
import { isArray } from '@vue/shared'

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

export function queueJob(job: SchedulerJob) {
  if (!(job.flags! & SchedulerJobFlags.QUEUED)) {
    if (job.id == null) {
      queue.push(job)
    } else if (
      // fast path when the job id is larger than the tail
      !(job.flags! & SchedulerJobFlags.PRE) &&
      job.id >= (queue[queue.length - 1]?.id || 0)
    ) {
      queue.push(job)
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job)
    }

    if (!(job.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
      job.flags! |= SchedulerJobFlags.QUEUED
    }
    queueFlush()
  }
}

export function queuePostFlushCb(cb: SchedulerJobs) {
  if (!isArray(cb)) {
    if (!(cb.flags! & SchedulerJobFlags.QUEUED)) {
      pendingPostFlushCbs.push(cb)
      if (!(cb.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
        cb.flags! |= SchedulerJobFlags.QUEUED
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

export function flushPostFlushCbs() {
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
    activePostFlushCbs[postFlushIndex].flags! &= ~SchedulerJobFlags.QUEUED
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
      queue[i]()
      queue[i].flags! &= ~SchedulerJobFlags.QUEUED
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
    if (
      middleJobId < id ||
      (middleJobId === id && middleJob.flags! & SchedulerJobFlags.PRE)
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
    const isAPre = a.flags! & SchedulerJobFlags.PRE
    const isBPre = b.flags! & SchedulerJobFlags.PRE
    if (isAPre && !isBPre) return -1
    if (isBPre && !isAPre) return 1
  }
  return diff
}

export type SchedulerFactory = (
  instance: ComponentInternalInstance | null,
) => WatchScheduler

export const createVaporSyncScheduler: SchedulerFactory =
  instance => (job, effect, immediateFirstRun, hasCb) => {
    if (immediateFirstRun) {
      effect.flags |= EffectFlags.NO_BATCH
      if (!hasCb) effect.run()
    } else {
      job()
    }
  }

export const createVaporPreScheduler: SchedulerFactory =
  instance => (job, effect, immediateFirstRun, hasCb) => {
    if (!immediateFirstRun) {
      job.flags! |= SchedulerJobFlags.PRE
      if (instance) job.id = instance.uid
      queueJob(job)
    } else if (!hasCb) {
      effect.run()
    }
  }

export const createVaporPostScheduler: SchedulerFactory =
  instance => (job, effect, immediateFirstRun, hasCb) => {
    if (!immediateFirstRun) {
      queuePostFlushCb(job)
    } else if (!hasCb) {
      queuePostFlushCb(effect.run.bind(effect))
    }
  }
