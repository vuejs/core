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
  type EffectScheduler,
  ReactiveEffect,
  pauseTracking,
  resetTracking,
} from './effect'
import { isReactive, isShallow } from './reactive'
import { type Ref, isRef } from './ref'
import { getCurrentScope } from './effectScope'

// These errors were transferred from `packages/runtime-core/src/errorHandling.ts`
// along with baseWatch to maintain code compatibility. Hence,
// it is essential to keep these values unchanged.
export enum BaseWatchErrorCodes {
  WATCH_GETTER = 2,
  WATCH_CALLBACK,
  WATCH_CLEANUP,
}

// TODO move to a scheduler package
export interface SchedulerJob extends Function {
  id?: number
  // TODO refactor these boolean flags to a single bitwise flag
  pre?: boolean
  active?: boolean
  computed?: boolean
  queued?: boolean
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
  allowRecurse?: boolean
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
  scheduler?: Scheduler
  middleware?: BaseWatchMiddleware
  onError?: HandleError
  onWarn?: HandleWarn
}

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

export type Scheduler = (
  job: SchedulerJob,
  effect: ReactiveEffect,
  isInit: boolean,
) => void
export type BaseWatchMiddleware = (next: () => unknown) => any
export type HandleError = (err: unknown, type: BaseWatchErrorCodes) => void
export type HandleWarn = (msg: string, ...args: any[]) => void

const DEFAULT_SCHEDULER: Scheduler = job => job()
const DEFAULT_HANDLE_ERROR: HandleError = (err: unknown) => {
  throw err
}

const cleanupMap: WeakMap<ReactiveEffect, (() => void)[]> = new WeakMap()
let activeEffect: ReactiveEffect | undefined = undefined

/**
 * Returns the current active effect if there is one.
 */
export function getCurrentEffect() {
  return activeEffect
}

/**
 * Registers a cleanup callback on the current active effect. This
 * registered cleanup callback will be invoked right before the
 * associated effect re-runs.
 *
 * @param cleanupFn - The callback function to attach to the effect's cleanup.
 */
export function onEffectCleanup(cleanupFn: () => void) {
  if (activeEffect) {
    const cleanups =
      cleanupMap.get(activeEffect) ||
      cleanupMap.set(activeEffect, []).get(activeEffect)!
    cleanups.push(cleanupFn)
  } else if (__DEV__) {
    warn(
      `onEffectCleanup() was called when there was no active effect` +
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
    middleware,
    onTrack,
    onTrigger,
  }: BaseWatchOptions = EMPTY_OBJ,
): ReactiveEffect | undefined {
  const warnInvalidSource = (s: unknown) => {
    onWarn(
      `Invalid watch source: `,
      s,
      `A watch source can only be a getter/effect function, a ref, ` +
        `a reactive object, or an array of these types.`,
    )
  }

  const reactiveGetter = (source: object) =>
    deep === true
      ? source // traverse will happen in wrapped getter below
      : // for deep: false, only traverse root-level properties
        traverse(source, deep === false ? 1 : undefined)

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
        const currentEffect = activeEffect
        activeEffect = effect
        try {
          return callWithAsyncErrorHandling(
            source,
            onError,
            BaseWatchErrorCodes.WATCH_CALLBACK,
            [onEffectCleanup],
          )
        } finally {
          activeEffect = currentEffect
        }
      }
      if (middleware) {
        const baseGetter = getter
        getter = () => middleware(baseGetter)
      }
    }
  } else {
    getter = NOOP
    __DEV__ && warnInvalidSource(source)
  }

  if (cb && deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  const scope = getCurrentScope()

  if (once) {
    if (!cb) {
      // onEffectCleanup need use effect as a key
      scope?.effects.push((effect = {} as any))
      getter()
      return
    }
    if (immediate) {
      // onEffectCleanup need use effect as a key
      scope?.effects.push((effect = {} as any))
      callWithAsyncErrorHandling(
        cb,
        onError,
        BaseWatchErrorCodes.WATCH_CALLBACK,
        [getter(), isMultiSource ? [] : undefined, onEffectCleanup],
      )
      return
    }
    const _cb = cb
    cb = (...args) => {
      _cb(...args)
      effect?.stop()
    }
  }

  let oldValue: any = isMultiSource
    ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
    : INITIAL_WATCHER_VALUE
  const job: SchedulerJob = () => {
    if (!effect.active || !effect.dirty) {
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
        const next = () => {
          // cleanup before running cb again
          if (cleanup) {
            cleanup()
          }
          const currentEffect = activeEffect
          activeEffect = effect
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
                onEffectCleanup,
              ],
            )
            oldValue = newValue
          } finally {
            activeEffect = currentEffect
          }
        }
        if (middleware) {
          middleware(next)
        } else {
          next()
        }
      }
    } else {
      // watchEffect
      effect.run()
    }
  }

  // important: mark the job as a watcher callback so that scheduler knows
  // it is allowed to self-trigger (#1727)
  job.allowRecurse = !!cb

  let effectScheduler: EffectScheduler = () => scheduler(job, effect, false)

  effect = new ReactiveEffect(getter, NOOP, effectScheduler, scope)

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
    if (immediate) {
      job()
    } else {
      oldValue = effect.run()
    }
  } else {
    scheduler(job, effect, true)
  }

  return effect
}

export function traverse(
  value: unknown,
  depth?: number,
  currentDepth = 0,
  seen?: Set<unknown>,
) {
  if (!isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
    return value
  }

  if (depth && depth > 0) {
    if (currentDepth >= depth) {
      return value
    }
    currentDepth++
  }

  seen = seen || new Set()
  if (seen.has(value)) {
    return value
  }
  seen.add(value)
  if (isRef(value)) {
    traverse(value.value, depth, currentDepth, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, currentDepth, seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, depth, currentDepth, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], depth, currentDepth, seen)
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
