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
  /**
   * Requeue a Suspense effect if its pending branch is discarded.
   * @internal
   */
  REQUEUE_ON_SUSPENSE_DISCARD = 1 << 3,
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
   * Also set on watcher jobs: null marks a watcher without an owner component.
   */
  i?: GenericComponentInstance | null
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

export function nextTick(): Promise<void>
export function nextTick<T, R>(
  this: T,
  fn: (this: T) => R | Promise<R>,
): Promise<R>
export function nextTick<T, R>(
  this: T,
  fn?: (this: T) => R | Promise<R>,
): Promise<void | R> {
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
export function queueJob(
  job: SchedulerJob,
  id?: number,
  isPre = false,
  order = 0,
): void {
  if (
    queueJobWorker(
      job,
      id === undefined
        ? isPre
          ? -2
          : Infinity
        : isPre
          ? id * 2
          : order
            ? // `order / (order + 1)` is monotonic and always < 1, so it sorts
              // same-component Vapor effects without changing component order.
              id * 2 + 1 + order / (order + 1)
            : id * 2 + 1,
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
    // If a nested pre/post flush throws after queueing more work, defer the
    // leftovers to a fresh microtask
    if (jobsLength || postJobs.length) {
      queueFlush()
    }
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
    // we can skip duplicate check here to improve perf.
    // use a loop instead of `push(...cb)`: the array can be arbitrarily large
    // (e.g. effects buffered by a suspense boundary) and spreading it would
    // overflow the call stack (#15142)
    for (let i = 0; i < jobs.length; i++) {
      queueJobWorker(jobs[i], id, postJobs, postJobs.length, 0)
    }
  }
  queueFlush()
}

export function flushPreFlushCbs(
  instance?: GenericComponentInstance,
  // root mount: only flush the jobs of the components it created
  minUid?: number,
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
    if (
      (instance && cb.order !== instance.uid * 2) ||
      (minUid !== undefined && !(cb.order! >= minUid * 2))
    ) {
      continue
    }
    if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
      continue
    }
    jobs.splice(i, 1)
    // A job may queue a job with a smaller order ahead of this index.
    i = instance ? i - 1 : flushIndex - 1
    jobsLength--
    if (cb.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
      cb.flags! &= ~SchedulerJobFlags.QUEUED
    }
    try {
      cb()
    } finally {
      if (!(cb.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
    }
  }
}

export function flushPostFlushCbs(
  seen?: CountMap,
  // root mount: cbs queued before it, left in the queue
  skip?: Set<SchedulerJob>,
  // root mount: watchers are kept or flushed by owner instead
  minUid = 0,
): void {
  if (postJobs.length) {
    let cbs = postJobs
    if (skip) {
      cbs = []
      let kept = 0
      for (let i = 0; i < postJobs.length; i++) {
        const cb = postJobs[i]
        if (cb.i !== undefined ? !cb.i || cb.i.uid < minUid : skip.has(cb)) {
          postJobs[kept++] = cb
        } else {
          cbs.push(cb)
        }
      }
      postJobs.length = kept
    } else {
      postJobs = []
    }

    // #1947 already has active queue, nested flushPostFlushCbs call
    if (activePostJobs) {
      for (let i = 0; i < cbs.length; i++) {
        activePostJobs.push(cbs[i])
      }
      return
    }

    activePostJobs = cbs

    if (__DEV__) {
      seen = seen || new Map()
    }

    try {
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
            if (!(cb.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
              cb.flags! &= ~SchedulerJobFlags.QUEUED
            }
          }
        }
      }
    } finally {
      // If there was an error we still need to clear the QUEUED flags
      while (postFlushIndex < activePostJobs.length) {
        activePostJobs[postFlushIndex++].flags! &= ~SchedulerJobFlags.QUEUED
      }

      activePostJobs = null
      postFlushIndex = 0
    }
  }
}

let isFlushing = false

/**
 * Run a root render, then flush the jobs it is responsible for. A mount or
 * unmount (`minUid` given) only flushes the jobs of the components it created
 * and the post cbs it queued, so pre watchers triggered in setup run before
 * mounted (#5721) while the jobs of other components stay in the queue and
 * keep their order (#6728). A root update keeps flushing all pending pre jobs
 * and post cbs, as the jobs of the components it re-renders may predate it.
 *
 * @internal
 */
export function flushOnAppMount(fn: () => void, minUid?: number): void {
  if (isFlushing) {
    fn()
    return
  }
  const queued = minUid === undefined ? undefined : new Set(postJobs)
  fn()
  isFlushing = true
  try {
    flushPreFlushCbs(undefined, minUid)
    flushPostFlushCbs(undefined, queued, minUid)
  } finally {
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
    jobs.length = 0

    flushPostFlushCbs(seen)

    // If new jobs have been added to either queue, keep flushing
    if (jobsLength || postJobs.length) {
      flushJobs(seen)
    } else {
      currentFlushPromise = null
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
