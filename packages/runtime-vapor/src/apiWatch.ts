import {
  type ComputedRef,
  type DebuggerOptions,
  type EffectScheduler,
  ReactiveEffect,
  ReactiveFlags,
  type Ref,
  getCurrentScope,
  isReactive,
  isRef,
} from '@vue/reactivity'
import {
  EMPTY_OBJ,
  NOOP,
  extend,
  hasChanged,
  isArray,
  isFunction,
  isMap,
  isObject,
  isPlainObject,
  isSet,
  remove,
} from '@vue/shared'
import { currentInstance } from './component'
import {
  type Scheduler,
  type SchedulerJob,
  getVaporSchedulerByFlushMode,
  vaporPostScheduler,
  vaporSyncScheduler,
} from './scheduler'
import {
  VaporErrorCodes,
  callWithAsyncErrorHandling,
  callWithErrorHandling,
} from './errorHandling'
import { warn } from './warning'

export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup,
) => any

type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? Immediate extends true
      ? V | undefined
      : V
    : T[K] extends object
      ? Immediate extends true
        ? T[K] | undefined
        : T[K]
      : never
}

type OnCleanup = (cleanupFn: () => void) => void

export interface WatchOptionsBase extends DebuggerOptions {
  flush?: 'pre' | 'post' | 'sync'
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate
  deep?: boolean
  once?: boolean
}

export type WatchStopHandle = () => void

// Simple effect.
export function watchEffect(
  effect: WatchEffect,
  options: WatchOptionsBase = EMPTY_OBJ,
): WatchStopHandle {
  const { flush } = options
  return doWatch(effect, null, getVaporSchedulerByFlushMode(flush), options)
}

export function watchPostEffect(
  effect: WatchEffect,
  options?: DebuggerOptions,
) {
  return doWatch(
    effect,
    null,
    vaporPostScheduler,
    __DEV__ ? extend({}, options as any, { flush: 'post' }) : { flush: 'post' },
  )
}

export function watchSyncEffect(
  effect: WatchEffect,
  options?: DebuggerOptions,
) {
  return doWatch(
    effect,
    null,
    vaporSyncScheduler,
    __DEV__ ? extend({}, options as any, { flush: 'sync' }) : { flush: 'sync' },
  )
}

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

type MultiWatchSources = (WatchSource<unknown> | object)[]

// overload: array of multiple sources + cb
export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false,
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle

// overload: multiple sources w/ `as const`
// watch([foo, bar] as const, () => {})
// somehow [...T] breaks when the type is readonly
export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false,
>(
  source: T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle

// overload: single source + cb
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle

// overload: watching reactive object w/ cb
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false,
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle

// implementation
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options: WatchOptions<Immediate> = EMPTY_OBJ,
): WatchStopHandle {
  if (__DEV__ && !isFunction(cb)) {
    warn(
      `\`watch(fn, options?)\` signature has been moved to a separate API. ` +
        `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
        `supports \`watch(source, cb, options?) signature.`,
    )
  }
  const { flush } = options
  return doWatch(
    source as any,
    cb,
    getVaporSchedulerByFlushMode(flush),
    options,
  )
}

const cleanupMap: WeakMap<ReactiveEffect, (() => void)[]> = new WeakMap()
let activeEffect: ReactiveEffect | undefined = undefined

// TODO: extract it to the reactivity package
export function onEffectCleanup(cleanupFn: () => void) {
  if (activeEffect) {
    const cleanups =
      cleanupMap.get(activeEffect) ||
      cleanupMap.set(activeEffect, []).get(activeEffect)!
    cleanups.push(cleanupFn)
  }
}

export interface doWatchOptions<Immediate = boolean> extends DebuggerOptions {
  immediate?: Immediate
  deep?: boolean
  once?: boolean
}

function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  scheduler: Scheduler,
  { immediate, deep, once, onTrack, onTrigger }: doWatchOptions = EMPTY_OBJ,
): WatchStopHandle {
  if (cb && once) {
    const _cb = cb
    cb = (...args) => {
      _cb(...args)
      unwatch()
    }
  }

  if (__DEV__ && !cb) {
    if (immediate !== undefined) {
      warn(
        `watch() "immediate" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`,
      )
    }
    if (deep !== undefined) {
      warn(
        `watch() "deep" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`,
      )
    }
    if (once !== undefined) {
      warn(
        `watch() "once" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`,
      )
    }
  }

  const warnInvalidSource = (s: unknown) => {
    warn(
      `Invalid watch source: `,
      s,
      `A watch source can only be a getter/effect function, a ref, ` +
        `a reactive object, or an array of these types.`,
    )
  }

  const instance =
    getCurrentScope() === currentInstance?.scope ? currentInstance : null
  // const instance = currentInstance
  let getter: () => any
  let forceTrigger = false
  let isMultiSource = false

  if (isRef(source)) {
    getter = () => source.value
  } else if (isReactive(source)) {
    getter = () => source
    deep = true
  } else if (isArray(source)) {
    getter = () =>
      source.map((s) => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          return traverse(s)
        } else if (isFunction(s)) {
          return callWithErrorHandling(
            s,
            instance,
            VaporErrorCodes.WATCH_GETTER,
          )
        } else {
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    if (cb) {
      // getter with cb
      getter = () =>
        callWithErrorHandling(source, instance, VaporErrorCodes.WATCH_GETTER)
    } else {
      // no cb -> simple effect
      getter = () => {
        if (instance && instance.isUnmounted) {
          return
        }
        if (cleanup) {
          cleanup()
        }
        const currentEffect = activeEffect
        activeEffect = effect
        try {
          return callWithAsyncErrorHandling(
            source,
            instance,
            VaporErrorCodes.WATCH_CALLBACK,
            [onEffectCleanup],
          )
        } finally {
          activeEffect = currentEffect
        }
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

  // TODO: ssr
  // if (__SSR__ && isInSSRComponentSetup) {
  // }

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
        // cleanup before running cb again
        if (cleanup) {
          cleanup()
        }
        const currentEffect = activeEffect
        activeEffect = effect
        try {
          callWithAsyncErrorHandling(
            cb,
            instance,
            VaporErrorCodes.WATCH_CALLBACK,
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
    } else {
      // watchEffect
      effect.run()
    }
  }

  // important: mark the job as a watcher callback so that scheduler knows
  // it is allowed to self-trigger (#1727)
  job.allowRecurse = !!cb

  let effectScheduler: EffectScheduler = () =>
    scheduler({
      effect,
      job,
      instance: instance,
      isInit: false,
    })

  const effect = new ReactiveEffect(getter, NOOP, effectScheduler)

  const cleanup = (effect.onStop = () => {
    const cleanups = cleanupMap.get(effect)
    if (cleanups) {
      cleanups.forEach((cleanup) => cleanup())
      cleanupMap.delete(effect)
    }
  })

  const unwatch = () => {
    effect.stop()
    if (instance && instance.scope) {
      remove(instance.scope.effects!, effect)
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
    scheduler({
      effect,
      job,
      instance: instance,
      isInit: true,
    })
  }

  // TODO: ssr
  // if (__SSR__ && ssrCleanup) ssrCleanup.push(unwatch)
  return unwatch
}

export function traverse(value: unknown, seen?: Set<unknown>) {
  if (!isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
    return value
  }
  seen = seen || new Set()
  if (seen.has(value)) {
    return value
  }
  seen.add(value)
  if (isRef(value)) {
    traverse(value.value, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
  return value
}
