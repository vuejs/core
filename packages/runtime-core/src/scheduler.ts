import { handleError, ErrorCodes } from './errorHandling'

const queue: Function[] = []
const postFlushCbs: Function[] = []
const p = Promise.resolve()

let isFlushing = false

export function nextTick(fn?: () => void): Promise<void> {
  return fn ? p.then(fn) : p
}

export function queueJob(job: () => void) {
  if (!queue.includes(job)) {
    queue.push(job)
    if (!isFlushing) {
      nextTick(flushJobs)
    }
  }
}

export function queuePostFlushCb(cbs: Function | Function[]) {
  if (!Array.isArray(cbs)) {
    cbs = [cbs]
  }

  postFlushCbs.push(...cbs)

  if (!isFlushing) {
    nextTick(flushJobs)
  }
}

const dedupe = (cbs: Function[]): Function[] => [...new Set(cbs)]

export function flushPostFlushCbs() {
  if (postFlushCbs.length) {
    const cbs = dedupe(postFlushCbs)
    postFlushCbs.length = 0
    for (const cb of cbs) cb()
  }
}

const RECURSION_LIMIT = 100
type JobCountMap = Map<Function, number>

function flushJobs(seenJobs?: JobCountMap) {
  isFlushing = true
  let job
  if (__DEV__) {
    seenJobs = seenJobs || new Map()
  }
  while ((job = queue.shift())) {
    if (__DEV__) {
      const seen = seenJobs!
      if (!seen.has(job)) {
        seen.set(job, 1)
      } else {
        const count = seen.get(job)!
        if (count > RECURSION_LIMIT) {
          throw new Error(
            'Maximum recursive updates exceeded. ' +
              "You may have code that is mutating state in your component's " +
              'render function or updated hook.'
          )
        } else {
          seen.set(job, count + 1)
        }
      }
    }
    try {
      job()
    } catch (err) {
      handleError(err, null, ErrorCodes.SCHEDULER)
    }
  }
  flushPostFlushCbs()
  isFlushing = false
  // some postFlushCb queued jobs!
  // keep flushing until it drains.
  if (queue.length) {
    flushJobs(seenJobs)
  }
}
