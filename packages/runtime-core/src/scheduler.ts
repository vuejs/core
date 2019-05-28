const queue: Function[] = []
const postFlushCbs: Function[] = []
const reversePostFlushCbs: Function[] = []
const p = Promise.resolve()

let isFlushing = false

export function nextTick(fn?: () => void): Promise<void> {
  return fn ? p.then(fn) : p
}

export function queueJob(job: () => void, onError?: (err: Error) => void) {
  if (queue.indexOf(job) === -1) {
    queue.push(job)
    if (!isFlushing) {
      const p = nextTick(flushJobs)
      if (onError) p.catch(onError)
    }
  }
}

export function queuePostFlushCb(cb: Function | Function[]) {
  queuePostCb(cb, postFlushCbs)
}

export function queueReversePostFlushCb(cb: Function | Function[]) {
  queuePostCb(cb, reversePostFlushCbs)
}

function queuePostCb(cb: Function | Function[], queue: Function[]) {
  if (Array.isArray(cb)) {
    queue.push.apply(postFlushCbs, cb)
  } else {
    queue.push(cb)
  }
}

const dedupe = (cbs: Function[]): Function[] => Array.from(new Set(cbs))

export function flushPostFlushCbs() {
  if (reversePostFlushCbs.length) {
    const cbs = dedupe(reversePostFlushCbs)
    reversePostFlushCbs.length = 0
    let i = cbs.length
    while (i--) {
      cbs[i]()
    }
  }
  if (postFlushCbs.length) {
    const cbs = dedupe(postFlushCbs)
    postFlushCbs.length = 0
    for (let i = 0; i < cbs.length; i++) {
      cbs[i]()
    }
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
      const seen = seenJobs as JobCountMap
      if (!seen.has(job)) {
        seen.set(job, 1)
      } else {
        const count = seen.get(job) as number
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
    job()
  }
  flushPostFlushCbs()
  isFlushing = false
  // some postFlushCb queued jobs!
  // keep flushing until it drains.
  if (queue.length) {
    flushJobs(seenJobs)
  }
}
