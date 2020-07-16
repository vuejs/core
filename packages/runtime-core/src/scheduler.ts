import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { isArray } from '@vue/shared'

export interface Job {
  (): void
  id?: number
}

const queue: (Job | null)[] = []
const postFlushCbs: Function[] = []
const p = Promise.resolve()

let isFlushing = false
let isFlushPending = false
let flushIndex = 0
let pendingPostFlushCbs: Function[] | null = null
let pendingPostFlushIndex = 0

const RECURSION_LIMIT = 100
type CountMap = Map<Job | Function, number>

export function nextTick(fn?: () => void): Promise<void> {
  return fn ? p.then(fn) : p
}

export function queueJob(job: Job) {
  if (!queue.includes(job, flushIndex)) {
    queue.push(job)
    queueFlush()
  }
}

export function invalidateJob(job: Job) {
  const i = queue.indexOf(job)
  if (i > -1) {
    queue[i] = null
  }
}

export function queuePostFlushCb(cb: Function | Function[]) {
  if (!isArray(cb)) {
    if (
      !pendingPostFlushCbs ||
      !pendingPostFlushCbs.includes(cb, pendingPostFlushIndex)
    ) {
      postFlushCbs.push(cb)
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip dupicate check here to improve perf
    postFlushCbs.push(...cb)
  }
  queueFlush()
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    nextTick(flushJobs)
  }
}

export function flushPostFlushCbs(seen?: CountMap) {
  if (postFlushCbs.length) {
    pendingPostFlushCbs = [...new Set(postFlushCbs)]
    postFlushCbs.length = 0
    if (__DEV__) {
      seen = seen || new Map()
    }
    for (
      pendingPostFlushIndex = 0;
      pendingPostFlushIndex < pendingPostFlushCbs.length;
      pendingPostFlushIndex++
    ) {
      if (__DEV__) {
        checkRecursiveUpdates(seen!, pendingPostFlushCbs[pendingPostFlushIndex])
      }
      pendingPostFlushCbs[pendingPostFlushIndex]()
    }
    pendingPostFlushCbs = null
    pendingPostFlushIndex = 0
  }
}

const getId = (job: Job) => (job.id == null ? Infinity : job.id)

function flushJobs(seen?: CountMap) {
  isFlushPending = false
  isFlushing = true
  if (__DEV__) {
    seen = seen || new Map()
  }

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child so its render effect will have smaller
  //    priority number)
  // 2. If a component is unmounted during a parent component's update,
  //    its update can be skipped.
  // Jobs can never be null before flush starts, since they are only invalidated
  // during execution of another flushed job.
  queue.sort((a, b) => getId(a!) - getId(b!))

  for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
    const job = queue[flushIndex]
    if (job) {
      if (__DEV__) {
        checkRecursiveUpdates(seen!, job)
      }
      callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
    }
  }
  flushIndex = 0
  queue.length = 0

  flushPostFlushCbs(seen)
  isFlushing = false
  // some postFlushCb queued jobs!
  // keep flushing until it drains.
  if (queue.length || postFlushCbs.length) {
    flushJobs(seen)
  }
}

function checkRecursiveUpdates(seen: CountMap, fn: Job | Function) {
  if (!seen.has(fn)) {
    seen.set(fn, 1)
  } else {
    const count = seen.get(fn)!
    if (count > RECURSION_LIMIT) {
      throw new Error(
        'Maximum recursive updates exceeded. ' +
          "You may have code that is mutating state in your component's " +
          'render function or updated hook or watcher source function.'
      )
    } else {
      seen.set(fn, count + 1)
    }
  }
}
