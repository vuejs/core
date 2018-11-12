// TODO infinite updates detection

// A data structure that stores a deferred DOM operation.
// the first element is the function to call, and the rest of the array
// stores up to 3 arguments.
type Op = [Function, ...any[]]

// A "job" stands for a unit of work that needs to be performed.
// Typically, one job corresponds to the mounting or updating of one component
// instance (including functional ones).
interface Job<T extends Function = () => void> {
  // A job is itself a function that performs work. It can contain work such as
  // calling render functions, running the diff algorithm (patch), mounting new
  // vnodes, and tearing down old vnodes. However, these work needs to be
  // performed in several different phases, most importantly to separate
  // workloads that do not produce side-effects ("stage") vs. those that do
  // ("commit").
  // During the stage call it should not perform any direct sife-effects.
  // Instead, it buffers them. All side effects from multiple jobs queued in the
  // same tick are flushed together during the "commit" phase. This allows us to
  // perform side-effect-free work over multiple frames (yielding to the browser
  // in-between to keep the app responsive), and only flush all the side effects
  // together when all work is done (AKA time-slicing).
  (): T
  // A job's status changes over the different update phaes. See comments for
  // phases below.
  status: JobStatus
  // Any operations performed by the job that directly mutates the DOM are
  // buffered inside the job's ops queue, and only flushed in the commit phase.
  // These ops are queued by calling `queueNodeOp` inside the job function.
  ops: Op[]
  // Any post DOM mutation side-effects (updated / mounted hooks, refs) are
  // buffered inside the job's effects queue.
  // Effects are queued by calling `queueEffect` inside the job function.
  effects: Function[]
  // A job may queue other jobs (e.g. a parent component update triggers the
  // update of a child component). Jobs queued by another job is kept in the
  // parent's children array, so that in case the parent job is invalidated,
  // all its children can be invalidated as well (recursively).
  children: Job[]
  // Sometimes it's inevitable for a stage fn to produce some side effects
  // (e.g. a component instance sets up an Autorun). In those cases the stage fn
  // can return a cleanup function which will be called when the job is
  // invalidated.
  cleanup: T | null
  // The expiration time is a timestamp past which the job needs to
  // be force-committed regardless of frame budget.
  // Why do we need an expiration time? Because a job may get invalidated before
  // it is fully commited. If it keeps getting invalidated, we may "starve" the
  // system and never apply any commits as jobs keep getting invalidated. The
  // expiration time sets a limit on how long before a job can keep getting
  // invalidated before it must be comitted.
  expiration: number
}

const enum JobStatus {
  IDLE = 0,
  PENDING_STAGE,
  PENDING_COMMIT
}

// Priorities for different types of jobs. This number is added to the
// current time when a new job is queued to calculate the expiration time
// for that job.
//
// Currently we have only one type which expires 500ms after it is initially
// queued. There could be higher/lower priorities in the future.
const enum JobPriorities {
  NORMAL = 500
}

// There can be only one job being patched at one time. This allows us to
// automatically "capture" and buffer the node ops and post effects queued
// during a job.
let currentJob: Job | null = null

// Indicates we have a flush pending.
let hasPendingFlush = false

// A timestamp that indicates when a flush was started.
let flushStartTimestamp: number = 0

// The frame budget is the maximum amount of time passed while performing
// "stage" work before we need to yield back to the browser.
// Aiming for 60fps. Maybe we need to dynamically adjust this?
const frameBudget = __JSDOM__ ? Infinity : 1000 / 60

const getNow = () => performance.now()

// An entire update consists of 4 phases:

// 1. Stage phase. Render functions are called, diffs are performed, new
//    component instances are created. However, no side-effects should be
//    performed (i.e. no lifecycle hooks, no direct DOM operations).
const stageQueue: Job[] = []

// 2. Commit phase. This is only reached when the stageQueue has been depleted.
//    Node ops are applied - in the browser, this means DOM is actually mutated
//    during this phase. If a job is committed, it's post effects are then
//    queued for the next phase.
const commitQueue: Job[] = []

// 3. Post-commit effects phase. Effect callbacks are only queued after a
//    successful commit. These include callbacks that need to be invoked
//    after DOM mutation - i.e. refs, mounted & updated hooks. This queue is
//    flushed in reverse because child component effects are queued after but
//    should be invoked before the parent's.
const postEffectsQueue: Function[] = []

// 4. NextTick phase. This is the user's catch-all mechanism for deferring
//    work after a complete update cycle.
const nextTickQueue: Function[] = []
const pendingRejectors: ErrorHandler[] = []

// Error handling --------------------------------------------------------------

type ErrorHandler = (err: Error) => any

let globalHandler: ErrorHandler

export function handleSchedulerError(handler: ErrorHandler) {
  globalHandler = handler
}

function handleError(err: Error) {
  if (globalHandler) globalHandler(err)
  pendingRejectors.forEach(handler => {
    handler(err)
  })
}

// Microtask defer -------------------------------------------------------------
// For batching state mutations before we start an update. This does
// NOT yield to the browser.

const p = Promise.resolve()

function flushAfterMicroTask() {
  flushStartTimestamp = getNow()
  return p.then(flush).catch(handleError)
}

// Macrotask defer -------------------------------------------------------------
// For time slicing. This uses the window postMessage event to "yield"
// to the browser so that other user events can trigger in between. This keeps
// the app responsive even when performing large amount of JavaScript work.

const key = `$vueTick`

window.addEventListener(
  'message',
  event => {
    if (event.source !== window || event.data !== key) {
      return
    }
    flushStartTimestamp = getNow()
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

// API -------------------------------------------------------------------------

// This is the main API of the scheduler. The raw job can actually be any
// function, but since they are invalidated by identity, it is important that
// a component's update job is a consistent function across its lifecycle -
// in the renderer, it's actually instance._updateHandle which is in turn
// an Autorun function.
export function queueJob(rawJob: Function) {
  const job = rawJob as Job
  if (currentJob) {
    currentJob.children.push(job)
  }
  // Let's see if this invalidates any work that
  // has already been staged.
  if (job.status === JobStatus.PENDING_COMMIT) {
    // staged job invalidated
    invalidateJob(job)
    // re-insert it into the stage queue
    requeueInvalidatedJob(job)
  } else if (job.status !== JobStatus.PENDING_STAGE) {
    // a new job
    queueJobForStaging(job)
  }
  if (!hasPendingFlush) {
    hasPendingFlush = true
    flushAfterMicroTask()
  }
}

export function queueEffect(fn: Function) {
  if (currentJob) {
    currentJob.effects.push(fn)
  } else {
    postEffectsQueue.push(fn)
  }
}

export function flushEffects() {
  // post commit hooks (updated, mounted)
  // this queue is flushed in reverse becuase these hooks should be invoked
  // child first
  let i = postEffectsQueue.length
  while (i--) {
    postEffectsQueue[i]()
  }
  postEffectsQueue.length = 0
}

export function queueNodeOp(op: Op) {
  if (currentJob) {
    currentJob.ops.push(op)
  } else {
    applyOp(op)
  }
}

// The original nextTick now needs to be reworked so that the callback only
// triggers after the next commit, when all node ops and post effects have been
// completed.
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

// Internals -------------------------------------------------------------------

function flush(): void {
  let job
  while (true) {
    job = stageQueue.shift()
    if (job) {
      stageJob(job)
    } else {
      break
    }
    if (!__COMPAT__) {
      const now = getNow()
      if (now - flushStartTimestamp > frameBudget && job.expiration > now) {
        break
      }
    }
  }

  if (stageQueue.length === 0) {
    // all done, time to commit!
    for (let i = 0; i < commitQueue.length; i++) {
      commitJob(commitQueue[i])
    }
    commitQueue.length = 0
    flushEffects()
    // some post commit hook triggered more updates...
    if (stageQueue.length > 0) {
      if (!__COMPAT__ && getNow() - flushStartTimestamp > frameBudget) {
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
    // shouldn't reach here in compat mode, because the stageQueue is
    // guarunteed to have been depleted
    flushAfterMacroTask()
  }
}

function resetJob(job: Job) {
  job.ops.length = 0
  job.effects.length = 0
  job.children.length = 0
}

function queueJobForStaging(job: Job) {
  job.ops = job.ops || []
  job.effects = job.effects || []
  job.children = job.children || []
  resetJob(job)
  // inherit parent job's expiration deadline
  job.expiration = currentJob
    ? currentJob.expiration
    : getNow() + JobPriorities.NORMAL
  stageQueue.push(job)
  job.status = JobStatus.PENDING_STAGE
}

function invalidateJob(job: Job) {
  // recursively invalidate all child jobs
  const { children } = job
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.status === JobStatus.PENDING_COMMIT) {
      invalidateJob(child)
    } else if (child.status === JobStatus.PENDING_STAGE) {
      stageQueue.splice(stageQueue.indexOf(child), 1)
      child.status = JobStatus.IDLE
    }
  }
  if (job.cleanup) {
    job.cleanup()
    job.cleanup = null
  }
  resetJob(job)
  // remove from commit queue
  commitQueue.splice(commitQueue.indexOf(job), 1)
  job.status = JobStatus.IDLE
}

function requeueInvalidatedJob(job: Job) {
  // With varying priorities we should insert job at correct position
  // based on expiration time.
  for (let i = 0; i < stageQueue.length; i++) {
    if (job.expiration < stageQueue[i].expiration) {
      stageQueue.splice(i, 0, job)
      job.status = JobStatus.PENDING_STAGE
      return
    }
  }
  stageQueue.push(job)
  job.status = JobStatus.PENDING_STAGE
}

function stageJob(job: Job) {
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
  const { ops, effects } = job
  for (let i = 0; i < ops.length; i++) {
    applyOp(ops[i])
  }
  // queue post commit cbs
  if (effects) {
    postEffectsQueue.push(...effects)
  }
  resetJob(job)
  job.status = JobStatus.IDLE
}

function applyOp(op: Op) {
  const fn = op[0]
  fn(op[1], op[2], op[3])
}
