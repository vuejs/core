import {
  EMPTY_OBJ,
  NOOP,
  hasChanged,
  isArray,
  isFunction,
  isMap,
  isObject,
  isPlainObject,
  isPromise,
  isSet,
} from '@vue/shared'
import { warn } from './warning'
import type { ComputedRef } from './computed'
import { ReactiveFlags } from './constants'
import {
  type DebuggerOptions,
  EffectFlags,
  ReactiveEffect,
  pauseTracking,
  resetTracking,
} from './effect'
import { isReactive, isShallow } from './reactive'
import { type Ref, isRef } from './ref'
import { type SchedulerJob, SchedulerJobFlags } from './scheduler'

// These errors were transferred from `packages/runtime-core/src/errorHandling.ts`
// along with baseWatch to maintain code compatibility. Hence,
// it is essential to keep these values unchanged.
export enum BaseWatchErrorCodes {
  WATCH_GETTER = 2,
  WATCH_CALLBACK,
  WATCH_CLEANUP,
}

type WatchEffect = (onCleanup: OnCleanup) => void
type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)
type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup,
) => any
type OnCleanup = (cleanupFn: () => void) => void

export interface BaseWatchOptions<Immediate = boolean> extends DebuggerOptions {
  immediate?: Immediate
  deep?: boolean
  once?: boolean
  scheduler?: WatchScheduler
  onError?: HandleError
  onWarn?: HandleWarn
}

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

export type WatchScheduler = (
  job: SchedulerJob,
  effect: ReactiveEffect,
  immediateFirstRun: boolean,
  hasCb: boolean,
) => void
export type HandleError = (err: unknown, type: BaseWatchErrorCodes) => void
export type HandleWarn = (msg: string, ...args: any[]) => void

const DEFAULT_SCHEDULER: WatchScheduler = (
  job,
  effect,
  immediateFirstRun,
  hasCb,
) => {
  if (immediateFirstRun) {
    !hasCb && effect.run()
  } else {
    job()
  }
}
const DEFAULT_HANDLE_ERROR: HandleError = (err: unknown) => {
  throw err
}

const cleanupMap: WeakMap<ReactiveEffect, (() => void)[]> = new WeakMap()
let activeWatcher: ReactiveEffect | undefined = undefined

/**
 * Returns the current active effect if there is one.
 */
export function getCurrentWatcher(): ReactiveEffect<any> | undefined {
  return activeWatcher
}

/**
 * Registers a cleanup callback on the current active effect. This
 * registered cleanup callback will be invoked right before the
 * associated effect re-runs.
 *
 * @param cleanupFn - The callback function to attach to the effect's cleanup.
 */
export function onWatcherCleanup(
  cleanupFn: () => void,
  failSilently = false,
): void {
  if (activeWatcher) {
    const cleanups =
      cleanupMap.get(activeWatcher) ||
      cleanupMap.set(activeWatcher, []).get(activeWatcher)!
    cleanups.push(cleanupFn)
  } else if (__DEV__ && !failSilently) {
    warn(
      `onWatcherCleanup() was called when there was no active watcher` +
        ` to associate with.`,
    )
  }
}

export function baseWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb?: WatchCallback | null,
  {
    immediate,
    deep,
    once,
    scheduler = DEFAULT_SCHEDULER,
    onWarn = __DEV__ ? warn : NOOP,
    onError = DEFAULT_HANDLE_ERROR,
    onTrack,
    onTrigger,
  }: BaseWatchOptions = EMPTY_OBJ,
): ReactiveEffect {
  const warnInvalidSource = (s: unknown) => {
    onWarn(
      `Invalid watch source: `,
      s,
      `A watch source can only be a getter/effect function, a ref, ` +
        `a reactive object, or an array of these types.`,
    )
  }

  const reactiveGetter = (source: object) => {
    // traverse will happen in wrapped getter below
    if (deep) return source
    // for `deep: false | 0` or shallow reactive, only traverse root-level properties
    if (isShallow(source) || deep === false || deep === 0)
      return traverse(source, 1)
    // for `deep: undefined` on a reactive object, deeply traverse all properties
    return traverse(source)
  }

  let effect: ReactiveEffect
  let getter: () => any
  let cleanup: (() => void) | undefined
  let forceTrigger = false
  let isMultiSource = false

  if (isRef(source)) {
    getter = () => source.value
    forceTrigger = isShallow(source)
  } else if (isReactive(source)) {
    getter = () => reactiveGetter(source)
    forceTrigger = true
  } else if (isArray(source)) {
    isMultiSource = true
    forceTrigger = source.some(s => isReactive(s) || isShallow(s))
    getter = () =>
      source.map(s => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          return reactiveGetter(s)
        } else if (isFunction(s)) {
          return callWithErrorHandling(
            s,
            onError,
            BaseWatchErrorCodes.WATCH_GETTER,
          )
        } else {
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    if (cb) {
      // getter with cb
      getter = () =>
        callWithErrorHandling(source, onError, BaseWatchErrorCodes.WATCH_GETTER)
    } else {
      // no cb -> simple effect
      getter = () => {
        if (cleanup) {
          pauseTracking()
          try {
            cleanup()
          } finally {
            resetTracking()
          }
        }
        const currentEffect = activeWatcher
        activeWatcher = effect
        try {
          return callWithAsyncErrorHandling(
            source,
            onError,
            BaseWatchErrorCodes.WATCH_CALLBACK,
            [onWatcherCleanup],
          )
        } finally {
          activeWatcher = currentEffect
        }
      }
    }
  } else {
    getter = NOOP
    __DEV__ && warnInvalidSource(source)
  }

  if (cb && deep) {
    const baseGetter = getter
    const depth = deep === true ? Infinity : deep
    getter = () => traverse(baseGetter(), depth)
  }

  if (once) {
    if (cb) {
      const _cb = cb
      cb = (...args) => {
        _cb(...args)
        effect.stop()
      }
    } else {
      const _getter = getter
      getter = () => {
        _getter()
        effect.stop()
      }
    }
  }

  let oldValue: any = isMultiSource
    ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
    : INITIAL_WATCHER_VALUE
  const job: SchedulerJob = (immediateFirstRun?: boolean) => {
    if (
      !(effect.flags & EffectFlags.ACTIVE) ||
      (!effect.dirty && !immediateFirstRun)
    ) {
      return
    }
    if (cb) {
      // watch(source, cb)
      const newValue = effect.run()
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) => hasChanged(v, oldValue[i]))
          : hasChanged(newValue, oldValue))
      ) {
        // cleanup before running cb again
        if (cleanup) {
          cleanup()
        }
        const currentWatcher = activeWatcher
        activeWatcher = effect
        try {
          callWithAsyncErrorHandling(
            cb!,
            onError,
            BaseWatchErrorCodes.WATCH_CALLBACK,
            [
              newValue,
              // pass undefined as the old value when it's changed for the first time
              oldValue === INITIAL_WATCHER_VALUE
                ? undefined
                : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE
                  ? []
                  : oldValue,
              onWatcherCleanup,
            ],
          )
          oldValue = newValue
        } finally {
          activeWatcher = currentWatcher
        }
      }
    } else {
      // watchEffect
      effect.run()
    }
  }

  // important: mark the job as a watcher callback so that scheduler knows
  // it is allowed to self-trigger (#1727)
  if (cb) job.flags! |= SchedulerJobFlags.ALLOW_RECURSE

  effect = new ReactiveEffect(getter)
  effect.scheduler = () => scheduler(job, effect, false, !!cb)

  cleanup = effect.onStop = () => {
    const cleanups = cleanupMap.get(effect)
    if (cleanups) {
      cleanups.forEach(cleanup =>
        callWithErrorHandling(
          cleanup,
          onError,
          BaseWatchErrorCodes.WATCH_CLEANUP,
        ),
      )
      cleanupMap.delete(effect)
    }
  }

  if (__DEV__) {
    effect.onTrack = onTrack
    effect.onTrigger = onTrigger
  }

  // initial run
  if (cb) {
    scheduler(job, effect, true, !!cb)
    if (immediate) {
      job(true)
    } else {
      oldValue = effect.run()
    }
  } else {
    scheduler(job, effect, true, !!cb)
  }

  return effect
}

export function traverse(
  value: unknown,
  depth: number = Infinity,
  seen?: Set<unknown>,
): unknown {
  if (depth <= 0 || !isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
    return value
  }

  seen = seen || new Set()
  if (seen.has(value)) {
    return value
  }
  seen.add(value)
  depth--
  if (isRef(value)) {
    traverse(value.value, depth, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, depth, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], depth, seen)
    }
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        traverse(value[key as any], depth, seen)
      }
    }
  }
  return value
}

function callWithErrorHandling(
  fn: Function,
  handleError: HandleError,
  type: BaseWatchErrorCodes,
  args?: unknown[],
) {
  let res
  try {
    res = args ? fn(...args) : fn()
  } catch (err) {
    handleError(err, type)
  }
  return res
}

function callWithAsyncErrorHandling(
  fn: Function | Function[],
  handleError: HandleError,
  type: BaseWatchErrorCodes,
  args?: unknown[],
): any[] {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn, handleError, type, args)
    if (res && isPromise(res)) {
      res.catch(err => {
        handleError(err, type)
      })
    }
    return res
  }

  const values = []
  for (let i = 0; i < fn.length; i++) {
    values.push(callWithAsyncErrorHandling(fn[i], handleError, type, args))
  }
  return values
}
