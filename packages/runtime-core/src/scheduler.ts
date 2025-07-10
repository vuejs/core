import { ErrorCodes, handleError } from './errorHandling'
import { isArray } from '@vue/shared'
import { type GenericComponentInstance, getComponentName } from './component'

export enum SchedulerJobFlags {
  QUEUED = 1 << 0,
  /**
   * Indicates whether the effect is allowed to recursively trigger itself
   * when managed by the scheduler.
   *
   * By default, a job cannot trigger itself because some built-in method calls,
   * e.g. Array.prototype.push actually performs reads as well (#1740) which
   * can lead to confusing infinite loops.
   * The allowed cases are component update functions and watch callbacks.
   * Component update functions may update child component props, which in turn
   * trigger flush: "pre" watch callbacks that mutates state that the parent
   * relies on (#1801). Watch callbacks doesn't track its dependencies so if it
   * triggers itself again, it's likely intentional and it is the user's
   * responsibility to perform recursive state mutation that eventually
   * stabilizes (#1727).
   */
  ALLOW_RECURSE = 1 << 1,
  DISPOSED = 1 << 2,
}

export interface SchedulerJob extends Function {
  order?: number
  /**
   * flags can technically be undefined, but it can still be used in bitwise
   * operations just like 0.
   */
  flags?: SchedulerJobFlags
  /**
   * Attached by renderer.ts when setting up a component's render effect
   * Used to obtain component information when reporting max recursive updates.
   */
  i?: GenericComponentInstance
}

export type SchedulerJobs = SchedulerJob | SchedulerJob[]

const jobs: SchedulerJob[] = []

let postJobs: SchedulerJob[] = []
let activePostJobs: SchedulerJob[] | null = null
let currentFlushPromise: Promise<void> | null = null
let jobsLength = 0
let flushIndex = 0
let postFlushIndex = 0

const resolvedPromise = /*@__PURE__*/ Promise.resolve() as Promise<any>
const RECURSION_LIMIT = 100

type CountMap = Map<SchedulerJob, number>

export function nextTick<T = void, R = void>(
  this: T,
  fn?: (this: T) => R,
): Promise<Awaited<R>> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}

// Use binary-search to find a suitable position in the queue. The queue needs
// to be sorted in increasing order of the job ids. This ensures that:
// 1. Components are updated from parent to child. As the parent is always
//    created before the child it will always have a smaller id.
// 2. If a component is unmounted during a parent component's update, its update
//    can be skipped.
// A pre watcher will have the same id as its component's update job. The
// watcher should be inserted immediately before the update job. This allows
// watchers to be skipped if the component is unmounted by the parent update.
function findInsertionIndex(
  order: number,
  queue: SchedulerJob[],
  start: number,
  end: number,
) {
  while (start < end) {
    const middle = (start + end) >>> 1
    if (queue[middle].order! <= order) {
      start = middle + 1
    } else {
      end = middle
    }
  }
  return start
}

/**
 * @internal for runtime-vapor only
 */
export function queueJob(job: SchedulerJob, id?: number, isPre = false): void {
  if (
    queueJobWorker(
      job,
      id === undefined ? (isPre ? -2 : Infinity) : isPre ? id * 2 : id * 2 + 1,
      jobs,
      jobsLength,
      flushIndex,
    )
  ) {
    jobsLength++
    queueFlush()
  }
}

function queueJobWorker(
  job: SchedulerJob,
  order: number,
  queue: SchedulerJob[],
  length: number,
  flushIndex: number,
) {
  const flags = job.flags!
  if (!(flags & SchedulerJobFlags.QUEUED)) {
    job.flags! = flags | SchedulerJobFlags.QUEUED
    job.order = order
    if (
      flushIndex === length ||
      // fast path when the job id is larger than the tail
      order >= queue[length - 1].order!
    ) {
      queue[length] = job
    } else {
      queue.splice(findInsertionIndex(order, queue, flushIndex, length), 0, job)
    }
    return true
  }
  return false
}

const doFlushJobs = () => {
  try {
    flushJobs()
  } catch (e) {
    currentFlushPromise = null
    throw e
  }
}

function queueFlush() {
  if (!currentFlushPromise) {
    currentFlushPromise = resolvedPromise.then(doFlushJobs)
  }
}

export function queuePostFlushCb(
  jobs: SchedulerJobs,
  id: number = Infinity,
): void {
  if (!isArray(jobs)) {
    if (activePostJobs && id === -1) {
      activePostJobs.splice(postFlushIndex, 0, jobs)
    } else {
      queueJobWorker(jobs, id, postJobs, postJobs.length, 0)
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip duplicate check here to improve perf
    for (const job of jobs) {
      queueJobWorker(job, id, postJobs, postJobs.length, 0)
    }
  }
  queueFlush()
}

export function flushPreFlushCbs(
  instance?: GenericComponentInstance,
  seen?: CountMap,
): void {
  if (__DEV__) {
    seen = seen || new Map()
  }
  for (let i = flushIndex; i < jobsLength; i++) {
    const cb = jobs[i]
    if (cb.order! & 1 || cb.order === Infinity) {
      continue
    }
    if (instance && cb.order !== instance.uid * 2) {
      continue
    }
    if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
      continue
    }
    jobs.splice(i, 1)
    i--
    jobsLength--
    if (cb.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
      cb.flags! &= ~SchedulerJobFlags.QUEUED
    }
    cb()
    if (!(cb.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
      cb.flags! &= ~SchedulerJobFlags.QUEUED
    }
  }
}

export function flushPostFlushCbs(seen?: CountMap): void {
  if (postJobs.length) {
    // #1947 already has active queue, nested flushPostFlushCbs call
    if (activePostJobs) {
      activePostJobs.push(...postJobs)
      postJobs.length = 0
      return
    }

    activePostJobs = postJobs
    postJobs = []

    if (__DEV__) {
      seen = seen || new Map()
    }

    while (postFlushIndex < activePostJobs.length) {
      const cb = activePostJobs[postFlushIndex++]
      if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
        continue
      }
      if (cb.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
      if (!(cb.flags! & SchedulerJobFlags.DISPOSED)) {
        try {
          cb()
        } finally {
          cb.flags! &= ~SchedulerJobFlags.QUEUED
        }
      }
    }

    activePostJobs = null
    postFlushIndex = 0
  }
}

let isFlushing = false
/**
 * @internal
 */
export function flushOnAppMount(): void {
  if (!isFlushing) {
    isFlushing = true
    flushPreFlushCbs()
    flushPostFlushCbs()
    isFlushing = false
  }
}

function flushJobs(seen?: CountMap) {
  if (__DEV__) {
    seen ||= new Map()
  }

  try {
    while (flushIndex < jobsLength) {
      const job = jobs[flushIndex]
      jobs[flushIndex++] = undefined as any

      if (!(job.flags! & SchedulerJobFlags.DISPOSED)) {
        // conditional usage of checkRecursiveUpdate must be determined out of
        // try ... catch block since Rollup by default de-optimizes treeshaking
        // inside try-catch. This can leave all warning code unshaked. Although
        // they would get eventually shaken by a minifier like terser, some minifiers
        // would fail to do that (e.g. https://github.com/evanw/esbuild/issues/1610)
        if (__DEV__ && checkRecursiveUpdates(seen!, job)) {
          continue
        }
        if (job.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
          job.flags! &= ~SchedulerJobFlags.QUEUED
        }
        try {
          job()
        } catch (err) {
          handleError(
            err,
            job.i,
            job.i ? ErrorCodes.COMPONENT_UPDATE : ErrorCodes.SCHEDULER,
          )
        } finally {
          if (!(job.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
            job.flags! &= ~SchedulerJobFlags.QUEUED
          }
        }
      }
    }
  } finally {
    // If there was an error we still need to clear the QUEUED flags
    while (flushIndex < jobsLength) {
      jobs[flushIndex].flags! &= ~SchedulerJobFlags.QUEUED
      jobs[flushIndex++] = undefined as any
    }

    flushIndex = 0
    jobsLength = 0

    flushPostFlushCbs(seen)

    currentFlushPromise = null
    // If new jobs have been added to either queue, keep flushing
    if (jobsLength || postJobs.length) {
      flushJobs(seen)
    }
  }
}

function checkRecursiveUpdates(seen: CountMap, fn: SchedulerJob) {
  const count = seen.get(fn) || 0
  if (count > RECURSION_LIMIT) {
    const instance = fn.i
    const componentName = instance && getComponentName(instance.type)
    handleError(
      `Maximum recursive updates exceeded${
        componentName ? ` in component <${componentName}>` : ``
      }. ` +
        `This means you have a reactive effect that is mutating its own ` +
        `dependencies and thus recursively triggering itself. Possible sources ` +
        `include component template, render function, updated hook or ` +
        `watcher source function.`,
      null,
      ErrorCodes.APP_ERROR_HANDLER,
    )
    return true
  }
  seen.set(fn, count + 1)
  return false
}
