import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { isArray } from '@vue/shared'

const queue: Function[] = []
const lowQueue: Function[] = []
const postFlushCbs: Function[] = []
const p = Promise.resolve()

let isFlushing = false
let isFlushPending = false
let queueCongestion = 0

const RECURSION_LIMIT = 100
type CountMap = Map<Function, number>

export function nextTick(fn?: () => void): Promise<void> {
  return fn ? p.then(fn) : p
}

export function queueJob(job: () => void) {
  if (!queue.includes(job)) {
    queue.push(job)
    queueFlush()
  }
}

export function queuePostFlushCb(cb: Function | Function[]) {
  if (!isArray(cb)) {
    postFlushCbs.push(cb)
  } else {
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

const dedupe = (cbs: Function[]): Function[] => [...new Set(cbs)]

export function flushPostFlushCbs(seen?: CountMap) {
  if (postFlushCbs.length) {
    const cbs = dedupe(postFlushCbs)
    postFlushCbs.length = 0
    if (__DEV__) {
      seen = seen || new Map()
    }
    for (let i = 0; i < cbs.length; i++) {
      if (__DEV__) {
        checkRecursiveUpdates(seen!, cbs[i])
      }
      cbs[i]()
    }
  }
}

function flushCbs(queue, timeout) {
  let ts = 0
  while ((job = queue.shift()) && (ts = performance.now()) < timeout) {
    if (__DEV__) {
      checkRecursiveUpdates(seen!, job)
    }
    callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
  }
}

function flushJobs(seen?: CountMap) {
  isFlushPending = false
  isFlushing = true
  queueCongestion++
  let job
  if (__DEV__) {
    seen = seen || new Map()
  }
  const timeout = performance.now() + 10 * Math.ceil(queueCongestion * (1.0 / 22.0))
  flushCbs(queue, timeout)
  flushCbs(lowQueue, timeout)
  if (queue.length > 0) {
    lowQueue.push(...queue)
    queue.length = 0
  }
  flushPostFlushCbs(seen)
  isFlushing = false
  // some postFlushCb queued jobs!
  // keep flushing until it drains.
  if (queue.length || postFlushCbs.length) {
    flushJobs(seen)
  }
}

function checkRecursiveUpdates(seen: CountMap, fn: Function) {
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
