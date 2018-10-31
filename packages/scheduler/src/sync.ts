const queue: Array<() => void> = []
const postFlushCbs: Array<() => void> = []
const p = Promise.resolve()

let isFlushing = false

export function nextTick(fn?: () => void): Promise<void> {
  return p.then(fn)
}

export function queueJob(
  job: () => void,
  postFlushCb?: () => void,
  onError?: (err: Error) => void
) {
  if (queue.indexOf(job) === -1) {
    queue.push(job)
    if (!isFlushing) {
      isFlushing = true
      const p = nextTick(flushJobs)
      if (onError) p.catch(onError)
    }
  }
  if (postFlushCb && postFlushCbs.indexOf(postFlushCb) === -1) {
    postFlushCbs.push(postFlushCb)
  }
}

const RECURSION_LIMIT = 100
type JobCountMap = Map<Function, number>

function flushJobs(seenJobs?: JobCountMap) {
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
  const cbs = postFlushCbs.slice()
  postFlushCbs.length = 0
  for (let i = 0; i < cbs.length; i++) {
    cbs[i]()
  }
  // some postFlushCb queued jobs!
  // keep flushing until it drains.
  if (queue.length) {
    flushJobs(seenJobs)
  } else {
    isFlushing = false
  }
}
