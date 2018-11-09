// TODO infinite updates detection

type Op = [Function, ...any[]]

const enum Priorities {
  NORMAL = 500
}

const enum JobStatus {
  PENDING_PATCH = 1,
  PENDING_COMMIT,
  COMMITED
}

interface Job extends Function {
  status: JobStatus
  ops: Op[]
  post: Function[]
  cleanup: Function | null
  expiration: number
}

type ErrorHandler = (err: Error) => any

let currentJob: Job | null = null

let start: number = 0
const getNow = () => performance.now()
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
  start = getNow()
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
  // 1. let's see if this invalidates any work that
  // has already been done.
  if (job.status === JobStatus.PENDING_COMMIT) {
    // pending commit job invalidated
    invalidateJob(job)
  } else if (job.status !== JobStatus.PENDING_PATCH) {
    // a new job
    insertNewJob(job)
  }
  if (!hasPendingFlush) {
    hasPendingFlush = true
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
  let i = postCommitQueue.length
  while (i--) {
    postCommitQueue[i]()
  }
  postCommitQueue.length = 0
}

export function queueNodeOp(op: Op) {
  if (currentJob) {
    currentJob.ops.push(op)
  } else {
    applyOp(op)
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
    for (let i = 0; i < commitQueue.length; i++) {
      commitJob(commitQueue[i])
    }
    commitQueue.length = 0
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
    for (let i = 0; i < nextTickQueue.length; i++) {
      nextTickQueue[i]()
    }
    nextTickQueue.length = 0
  } else {
    // got more job to do
    // shouldn't reach here in compat mode, because the patchQueue is
    // guarunteed to be drained
    flushAfterMacroTask()
  }
}

function insertNewJob(job: Job) {
  job.ops = job.ops || []
  job.post = job.post || []
  job.expiration = getNow() + Priorities.NORMAL
  patchQueue.push(job)
  job.status = JobStatus.PENDING_PATCH
}

function invalidateJob(job: Job) {
  job.ops.length = 0
  job.post.length = 0
  if (job.cleanup) {
    job.cleanup()
    job.cleanup = null
  }
  // remove from commit queue
  // and move it back to the patch queue
  commitQueue.splice(commitQueue.indexOf(job), 1)
  // With varying priorities we should insert job at correct position
  // based on expiration time.
  for (let i = 0; i < patchQueue.length; i++) {
    if (job.expiration < patchQueue[i].expiration) {
      patchQueue.splice(i, 0, job)
      break
    }
  }
  job.status = JobStatus.PENDING_PATCH
}

function patchJob(job: Job) {
  // job with existing ops means it's already been patched in a low priority queue
  if (job.ops.length === 0) {
    currentJob = job
    job.cleanup = job()
    currentJob = null
    commitQueue.push(job)
    job.status = JobStatus.PENDING_COMMIT
  }
}

function commitJob(job: Job) {
  const { ops, post } = job
  for (let i = 0; i < ops.length; i++) {
    applyOp(ops[i])
  }
  ops.length = 0
  // queue post commit cbs
  if (post) {
    postCommitQueue.push(...post)
    post.length = 0
  }
  job.status = JobStatus.COMMITED
}

function applyOp(op: Op) {
  const fn = op[0]
  fn(op[1], op[2], op[3])
}
