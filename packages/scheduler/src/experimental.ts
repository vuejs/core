// TODO infinite updates detection

import { Op, setCurrentOps } from './patchNodeOps'

interface Job extends Function {
  ops: Op[]
  post: Function[]
  cleanup: Function | null
  expiration: number
}

const enum Priorities {
  NORMAL = 500
}

type ErrorHandler = (err: Error) => any

let currentJob: Job | null = null

let start: number = 0
const getNow = () => window.performance.now()
const frameBudget = __JSDOM__ ? Infinity : 1000 / 60

const patchQueue: Job[] = []
const commitQueue: Job[] = []
const postCommitQueue: Function[] = []
const nextTickQueue: Function[] = []

let globalHandler: ErrorHandler
const pendingRejectors: ErrorHandler[] = []

// Microtask for batching state mutations
const p = Promise.resolve()

function flushAfterMicroTask() {
  return p.then(flush).catch(handleError)
}

// Macrotask for time slicing
const key = `$vueTick`

window.addEventListener(
  'message',
  event => {
    if (event.source !== window || event.data !== key) {
      return
    }
    start = getNow()
    try {
      flush()
    } catch (e) {
      handleError(e)
    }
  },
  false
)

function flushAfterMacroTask() {
  window.postMessage(key, `*`)
}

export function nextTick<T>(fn?: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    p.then(() => {
      if (hasPendingFlush) {
        nextTickQueue.push(() => {
          resolve(fn ? fn() : undefined)
        })
        pendingRejectors.push(err => {
          if (fn) fn()
          reject(err)
        })
      } else {
        resolve(fn ? fn() : undefined)
      }
    }).catch(reject)
  })
}

function handleError(err: Error) {
  if (globalHandler) globalHandler(err)
  pendingRejectors.forEach(handler => {
    handler(err)
  })
}

export function handleSchedulerError(handler: ErrorHandler) {
  globalHandler = handler
}

let hasPendingFlush = false

export function queueJob(rawJob: Function) {
  const job = rawJob as Job
  job.ops = job.ops || []
  job.post = job.post || []
  // 1. let's see if this invalidates any work that
  // has already been done.
  const commitIndex = commitQueue.indexOf(job)
  if (commitIndex > -1) {
    // invalidated. remove from commit queue
    // and move it back to the patch queue
    commitQueue.splice(commitIndex, 1)
    invalidateJob(job)
    // With varying priorities we should insert job at correct position
    // based on expiration time.
    for (let i = 0; i < patchQueue.length; i++) {
      if (job.expiration < patchQueue[i].expiration) {
        patchQueue.splice(i, 0, job)
        break
      }
    }
  } else if (patchQueue.indexOf(job) === -1) {
    // a new job
    job.expiration = getNow() + Priorities.NORMAL
    patchQueue.push(job)
  }

  if (!hasPendingFlush) {
    hasPendingFlush = true
    start = getNow()
    flushAfterMicroTask()
  }
}

export function queuePostCommitCb(fn: Function) {
  if (currentJob) {
    currentJob.post.push(fn)
  } else {
    postCommitQueue.push(fn)
  }
}

export function flushPostCommitCbs() {
  // post commit hooks (updated, mounted)
  // this queue is flushed in reverse becuase these hooks should be invoked
  // child first
  let job
  while ((job = postCommitQueue.pop())) {
    job()
  }
}

function flush(): void {
  let job
  while (true) {
    job = patchQueue.shift()
    if (job) {
      patchJob(job)
    } else {
      break
    }
    if (!__COMPAT__) {
      const now = getNow()
      if (now - start > frameBudget && job.expiration > now) {
        break
      }
    }
  }

  if (patchQueue.length === 0) {
    // all done, time to commit!
    while ((job = commitQueue.shift())) {
      commitJob(job)
      if (job.post) {
        postCommitQueue.push(...job.post)
        job.post.length = 0
      }
    }
    flushPostCommitCbs()
    // some post commit hook triggered more updates...
    if (patchQueue.length > 0) {
      if (!__COMPAT__ && getNow() - start > frameBudget) {
        return flushAfterMacroTask()
      } else {
        // not out of budget yet, flush sync
        return flush()
      }
    }
    // now we are really done
    hasPendingFlush = false
    pendingRejectors.length = 0
    while ((job = nextTickQueue.shift())) {
      job()
    }
  } else {
    // got more job to do
    // shouldn't reach here in compat mode, because the patchQueue is
    // guarunteed to be drained
    flushAfterMacroTask()
  }
}

function patchJob(job: Job) {
  // job with existing ops means it's already been patched in a low priority queue
  if (job.ops.length === 0) {
    setCurrentOps(job.ops)
    currentJob = job
    job.cleanup = job()
    currentJob = null
    setCurrentOps(null)
    commitQueue.push(job)
  }
}

function commitJob({ ops }: Job) {
  for (let i = 0; i < ops.length; i++) {
    const [fn, ...args] = ops[i]
    fn(...args)
  }
  ops.length = 0
}

function invalidateJob(job: Job) {
  job.ops.length = 0
  job.post.length = 0
  if (job.cleanup) {
    job.cleanup()
    job.cleanup = null
  }
}
