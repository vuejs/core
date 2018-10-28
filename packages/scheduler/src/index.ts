const queue: Array<() => void> = []
const postFlushCbs: Array<() => void> = []
const postFlushCbsForNextTick: Array<() => void> = []
const p = Promise.resolve()

let isFlushing = false
let isFlushingPostCbs = false

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
    if (!isFlushing || isFlushingPostCbs) {
      const p = nextTick(flushJobs)
      if (onError) p.catch(onError)
    }
  }
  if (postFlushCb) {
    if (isFlushingPostCbs) {
      // it's possible for a postFlushCb to queue another job/cb combo,
      // e.g. triggering a state update inside the updated hook.
      if (postFlushCbsForNextTick.indexOf(postFlushCb) === -1) {
        postFlushCbsForNextTick.push(postFlushCb)
      }
    } else if (postFlushCbs.indexOf(postFlushCb) === -1) {
      postFlushCbs.push(postFlushCb)
    }
  }
}

const seenJobs = new Map()
const RECURSION_LIMIT = 100

function flushJobs() {
  seenJobs.clear()
  isFlushing = true
  let job
  while ((job = queue.shift())) {
    if (__DEV__) {
      if (!seenJobs.has(job)) {
        seenJobs.set(job, 1)
      } else {
        const count = seenJobs.get(job)
        if (count > RECURSION_LIMIT) {
          throw new Error('Maximum recursive updates exceeded')
        } else {
          seenJobs.set(job, count + 1)
        }
      }
    }
    job()
  }
  isFlushingPostCbs = true
  if (postFlushCbsForNextTick.length > 0) {
    const postFlushCbsFromPrevTick = postFlushCbsForNextTick.slice()
    postFlushCbsForNextTick.length = 0
    for (let i = 0; i < postFlushCbsFromPrevTick.length; i++) {
      postFlushCbsFromPrevTick[i]()
    }
  }
  for (let i = 0; i < postFlushCbs.length; i++) {
    postFlushCbs[i]()
  }
  postFlushCbs.length = 0
  isFlushingPostCbs = false
  isFlushing = false
}
