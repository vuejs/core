import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { isArray, isObject } from '@vue/shared'
import { ReactiveEffectOptions } from '@vue/reactivity'
import { Component } from './component'
import { BaseTransition } from './components/BaseTransition'

const queue: (null | (Function & { options?: ReactiveEffectOptions }))[] = []
const postFlushCbs: Function[] = []
const p = Promise.resolve()

let isFlushing = false
let isFlushPending = false

const RECURSION_LIMIT = 100
type CountMap = Map<Function, number>

export function nextTick(fn?: () => void): Promise<void> {
  return fn ? p.then(fn) : p
}

export function queueJob(
  job: (() => void) & { options?: ReactiveEffectOptions }
) {
  // fix transition: https://github.com/vuejs/vue-next/issues/681
  if (
    queue.length > 0 &&
    job.options &&
    // Instance is undefined in unit tests
    job.options.instance
  ) {
    let parent = job.options.instance.parent
    const queuedJobInstances = queue.map(
      job => job && job.options && job.options.instance
    )
    while (parent) {
      // If any queued effect has a corresponding instance that is parent
      // of this effect's instance, don't queue this effect
      if (
        parent.vnode.transition ||
        (isObject(parent.vnode.type) &&
          (parent.vnode.type as Component).name === BaseTransition.name &&
          queuedJobInstances.includes(parent))
      ) {
        return
      }
      parent = parent.parent
    }
  }
  if (!queue.includes(job)) {
    queue.push(job)
    queueFlush()
  }
}

export function invalidateJob(job: () => void) {
  const i = queue.indexOf(job)
  if (i > -1) {
    queue[i] = null
  }
}

export function queuePostFlushCb(cb: Function | Function[]) {
  if (!isArray(cb)) {
    postFlushCbs.push(cb)
  } else {
    postFlushCbs.push(...cb)
  }
  queueFlush()
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    nextTick(flushJobs)
  }
}

const dedupe = (cbs: Function[]): Function[] => [...new Set(cbs)]

export function flushPostFlushCbs(seen?: CountMap) {
  if (postFlushCbs.length) {
    const cbs = dedupe(postFlushCbs)
    postFlushCbs.length = 0
    if (__DEV__) {
      seen = seen || new Map()
    }
    for (let i = 0; i < cbs.length; i++) {
      if (__DEV__) {
        checkRecursiveUpdates(seen!, cbs[i])
      }
      cbs[i]()
    }
  }
}

function flushJobs(seen?: CountMap) {
  isFlushPending = false
  isFlushing = true
  let job
  if (__DEV__) {
    seen = seen || new Map()
  }
  while ((job = queue.shift()) !== undefined) {
    if (job === null) {
      continue
    }
    if (__DEV__) {
      checkRecursiveUpdates(seen!, job)
    }
    callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
  }
  flushPostFlushCbs(seen)
  isFlushing = false
  // some postFlushCb queued jobs!
  // keep flushing until it drains.
  if (queue.length || postFlushCbs.length) {
    flushJobs(seen)
  }
}

function checkRecursiveUpdates(seen: CountMap, fn: Function) {
  if (!seen.has(fn)) {
    seen.set(fn, 1)
  } else {
    const count = seen.get(fn)!
    if (count > RECURSION_LIMIT) {
      throw new Error(
        'Maximum recursive updates exceeded. ' +
          "You may have code that is mutating state in your component's " +
          'render function or updated hook or watcher source function.'
      )
    } else {
      seen.set(fn, count + 1)
    }
  }
}
