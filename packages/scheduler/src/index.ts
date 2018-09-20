const queue: Array<() => void> = []
const postFlushCbs: Array<() => void> = []
const p = Promise.resolve()

let flushing = false

export function nextTick(fn?: () => void): Promise<void> {
  return p.then(fn)
}

export function queueJob(job: () => void, postFlushCb?: () => void) {
  if (queue.indexOf(job) === -1) {
    if (flushing) {
      job()
    } else {
      queue.push(job)
    }
  }
  if (postFlushCb) {
    postFlushCbs.push(postFlushCb)
  }
  if (!flushing) {
    nextTick(flushJobs)
  }
}

function flushJobs() {
  flushing = true
  let job
  while ((job = queue.shift())) {
    job()
  }
  while ((job = postFlushCbs.shift())) {
    job()
  }
  flushing = false
}
