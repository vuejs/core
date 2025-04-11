import { ErrorCodes, callWithErrorHandling, handleError } from './errorHandling'
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
  id?: number
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

const queueMainJobs: (SchedulerJob | undefined)[] = []
const queuePreJobs: (SchedulerJob | undefined)[] = []
const queuePostJobs: (SchedulerJob | undefined)[] = []

let mainFlushIndex = -1
let preFlushIndex = -1
let postFlushIndex = 0
let mainJobsLength = 0
let preJobsLength = 0
let postJobsLength = 0
let flushingPreJob = false
let activePostFlushCbs: SchedulerJob[] | null = null
let currentFlushPromise: Promise<void> | null = null

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
function findInsertionIndex(id: number, isPre: boolean) {
  let start = (isPre ? preFlushIndex : mainFlushIndex) + 1
  let end = isPre ? preJobsLength : mainJobsLength
  const queue = isPre ? queuePreJobs : queueMainJobs

  while (start < end) {
    const middle = (start + end) >>> 1
    const middleJob = queue[middle]!
    if (middleJob.id! <= id) {
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
export function queueJob(job: SchedulerJob, isPre = false): void {
  if (!(job.flags! & SchedulerJobFlags.QUEUED)) {
    if (job.id === undefined) {
      job.id = isPre ? -1 : Infinity
    }
    const queueLength = isPre ? preJobsLength : mainJobsLength
    const queue = isPre ? queuePreJobs : queueMainJobs
    if (
      !queueLength ||
      // fast path when the job id is larger than the tail
      job.id >= queue[queueLength - 1]!.id!
    ) {
      queue[queueLength] = job
    } else {
      queue.splice(findInsertionIndex(job.id, isPre), 0, job)
    }
    isPre ? preJobsLength++ : mainJobsLength++

    job.flags! |= SchedulerJobFlags.QUEUED

    queueFlush()
  }
}

function queueFlush() {
  if (!currentFlushPromise) {
    currentFlushPromise = resolvedPromise.then(flushJobs).catch(e => {
      currentFlushPromise = null
      throw e
    })
  }
}

export function queuePostFlushCb(cb: SchedulerJobs): void {
  if (!isArray(cb)) {
    if (cb.id === undefined) {
      cb.id = Infinity
    }
    if (activePostFlushCbs && cb.id === -1) {
      activePostFlushCbs.splice(postFlushIndex + 1, 0, cb)
    } else if (!(cb.flags! & SchedulerJobFlags.QUEUED)) {
      queuePostJobs[postJobsLength++] = cb
      cb.flags! |= SchedulerJobFlags.QUEUED
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip duplicate check here to improve perf
    for (const job of cb) {
      if (job.id === undefined) {
        job.id = Infinity
      }
      queuePostJobs[postJobsLength++] = job
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
  for (
    let i = flushingPreJob ? preFlushIndex + 1 : preFlushIndex;
    i < preJobsLength;
    i++
  ) {
    const cb = queuePreJobs[i]
    if (cb) {
      if (instance && cb.id !== instance.uid) {
        continue
      }
      if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
        continue
      }
      queuePreJobs.splice(i, 1)
      preJobsLength--
      i--
      if (cb.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
      cb()
      if (!(cb.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
    }
  }
}

export function flushPostFlushCbs(seen?: CountMap): void {
  if (postJobsLength) {
    const deduped = new Set<SchedulerJob>()
    for (let i = 0; i < postJobsLength; i++) {
      const job = queuePostJobs[i]!
      queuePostJobs[i] = undefined
      deduped.add(job)
    }
    postJobsLength = 0

    const sorted = [...deduped].sort((a, b) => a.id! - b.id!)

    // #1947 already has active queue, nested flushPostFlushCbs call
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...sorted)
      return
    }

    activePostFlushCbs = sorted
    if (__DEV__) {
      seen = seen || new Map()
    }

    for (
      postFlushIndex = 0;
      postFlushIndex < activePostFlushCbs.length;
      postFlushIndex++
    ) {
      const cb = activePostFlushCbs[postFlushIndex]
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
    activePostFlushCbs = null
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
    seen = seen || new Map()
  }

  try {
    preFlushIndex = 0
    mainFlushIndex = 0

    while (preFlushIndex < preJobsLength || mainFlushIndex < mainJobsLength) {
      let job: SchedulerJob
      if (preFlushIndex < preJobsLength) {
        if (mainFlushIndex < mainJobsLength) {
          const preJob = queuePreJobs[preFlushIndex]!
          const mainJob = queueMainJobs[mainFlushIndex]!
          if (preJob.id! <= mainJob.id!) {
            job = preJob
            flushingPreJob = true
          } else {
            job = mainJob
            flushingPreJob = false
          }
        } else {
          job = queuePreJobs[preFlushIndex]!
          flushingPreJob = true
        }
      } else {
        job = queueMainJobs[mainFlushIndex]!
        flushingPreJob = false
      }

      if (!(job.flags! & SchedulerJobFlags.DISPOSED)) {
        // conditional usage of checkRecursiveUpdate must be determined out of
        // try ... catch block since Rollup by default de-optimizes treeshaking
        // inside try-catch. This can leave all warning code unshaked. Although
        // they would get eventually shaken by a minifier like terser, some minifiers
        // would fail to do that (e.g. https://github.com/evanw/esbuild/issues/1610)
        if (__DEV__ && checkRecursiveUpdates(seen!, job)) {
          if (flushingPreJob) {
            queuePreJobs[preFlushIndex++] = undefined
          } else {
            queueMainJobs[mainFlushIndex++] = undefined
          }
          continue
        }
        if (job.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
          job.flags! &= ~SchedulerJobFlags.QUEUED
        }
        callWithErrorHandling(
          job,
          job.i,
          job.i ? ErrorCodes.COMPONENT_UPDATE : ErrorCodes.SCHEDULER,
        )
        if (!(job.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
          job.flags! &= ~SchedulerJobFlags.QUEUED
        }
      }

      if (flushingPreJob) {
        queuePreJobs[preFlushIndex++] = undefined
      } else {
        queueMainJobs[mainFlushIndex++] = undefined
      }
    }
  } finally {
    // If there was an error we still need to clear the QUEUED flags
    while (preFlushIndex < preJobsLength) {
      const job = queuePreJobs[preFlushIndex]
      queuePreJobs[preFlushIndex++] = undefined
      if (job) {
        job.flags! &= ~SchedulerJobFlags.QUEUED
      }
    }
    while (mainFlushIndex < mainJobsLength) {
      const job = queueMainJobs[mainFlushIndex]
      queueMainJobs[mainFlushIndex++] = undefined
      if (job) {
        job.flags! &= ~SchedulerJobFlags.QUEUED
      }
    }

    preFlushIndex = -1
    mainFlushIndex = -1
    preJobsLength = 0
    mainJobsLength = 0
    flushingPreJob = false

    flushPostFlushCbs(seen)

    currentFlushPromise = null
    // If new jobs have been added to either queue, keep flushing
    if (preJobsLength || mainJobsLength || postJobsLength) {
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
