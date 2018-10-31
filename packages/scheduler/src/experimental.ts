import { NodeOps } from '@vue/runtime-core'
import { nodeOps } from '../../runtime-dom/src/nodeOps'

const enum Priorities {
  NORMAL = 500
}

const frameBudget = 1000 / 60

let currentOps: Op[]

const evaluate = (v: any) => {
  return typeof v === 'function' ? v() : v
}

// patch nodeOps to record operations without touching the DOM
Object.keys(nodeOps).forEach((key: keyof NodeOps) => {
  const original = nodeOps[key] as Function
  if (key === 'querySelector') {
    return
  }
  if (/create/.test(key)) {
    nodeOps[key] = (...args: any[]) => {
      if (currentOps) {
        let res: any
        return () => {
          return res || (res = original(...args))
        }
      } else {
        return original(...args)
      }
    }
  } else {
    nodeOps[key] = (...args: any[]) => {
      if (currentOps) {
        currentOps.push([original, ...args.map(evaluate)])
      } else {
        original(...args)
      }
    }
  }
})

type Op = [Function, ...any[]]

interface Job extends Function {
  ops: Op[]
  post: Function
  expiration: number
}

// Microtask for batching state mutations
const p = Promise.resolve()

export function nextTick(fn?: () => void): Promise<void> {
  return p.then(fn)
}

// Macrotask for time slicing
const key = `__vueSchedulerTick`

window.addEventListener(
  'message',
  event => {
    if (event.source !== window || event.data !== key) {
      return
    }
    flush()
  },
  false
)

function flushAfterYield() {
  window.postMessage(key, `*`)
}

const patchQueue: Job[] = []
const commitQueue: Job[] = []

function patch(job: Job) {
  // job with existing ops means it's already been patched in a low priority queue
  if (job.ops.length === 0) {
    currentOps = job.ops
    job()
    commitQueue.push(job)
  }
}

function commit({ ops }: Job) {
  for (let i = 0; i < ops.length; i++) {
    const [fn, ...args] = ops[i]
    fn(...args)
  }
  ops.length = 0
}

function invalidate(job: Job) {
  job.ops.length = 0
}

let hasPendingFlush = false

export function queueJob(
  rawJob: Function,
  postJob: Function,
  onError?: (reason: any) => void
) {
  const job = rawJob as Job
  job.post = postJob
  job.ops = job.ops || []
  // 1. let's see if this invalidates any work that
  // has already been done.
  const commitIndex = commitQueue.indexOf(job)
  if (commitIndex > -1) {
    // invalidated. remove from commit queue
    // and move it back to the patch queue
    commitQueue.splice(commitIndex, 1)
    invalidate(job)
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
    job.expiration = performance.now() + Priorities.NORMAL
    patchQueue.push(job)
  }

  if (!hasPendingFlush) {
    hasPendingFlush = true
    const p = nextTick(flush)
    if (onError) p.catch(onError)
  }
}

function flush() {
  let job
  let start = window.performance.now()
  while (true) {
    job = patchQueue.shift()
    if (job) {
      patch(job)
    } else {
      break
    }
    const now = performance.now()
    if (now - start > frameBudget && job.expiration > now) {
      break
    }
  }

  if (patchQueue.length === 0) {
    const postQueue: Function[] = []
    // all done, time to commit!
    while ((job = commitQueue.shift())) {
      commit(job)
      if (job.post && postQueue.indexOf(job.post) < 0) {
        postQueue.push(job.post)
      }
    }
    while ((job = postQueue.shift())) {
      job()
    }
    if (patchQueue.length > 0) {
      return flushAfterYield()
    }
    hasPendingFlush = false
  } else {
    // got more job to do
    flushAfterYield()
  }
}
