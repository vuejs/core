const queue: Array<() => void> = []
const postFlushCbs: Array<() => void> = []
const p = Promise.resolve()

let hasPendingFlush = false

export function nextTick(fn?: () => void): Promise<void> {
  return p.then(fn)
}

export function queueJob(job: () => void, postFlushCb?: () => void) {
  if (queue.indexOf(job) === -1) {
    queue.push(job)
    if (!hasPendingFlush) {
      hasPendingFlush = true
      nextTick(flushJobs)
    }
  }
  if (postFlushCb && postFlushCbs.indexOf(postFlushCb) === -1) {
    postFlushCbs.push(postFlushCb)
  }
}

function flushJobs() {
  let job
  while ((job = queue.shift())) {
    job()
  }
  while ((job = postFlushCbs.shift())) {
    job()
  }
  hasPendingFlush = false
}
