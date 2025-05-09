import {
  EMPTY_OBJ,
  NOOP,
  hasChanged,
  isArray,
  isFunction,
  isMap,
  isObject,
  isPlainObject,
  isSet,
} from '@vue/shared'
import type { ComputedRef } from './computed'
import { ReactiveFlags } from './constants'
import { type DebuggerOptions, ReactiveEffect, cleanup } from './effect'
import { isReactive, isShallow } from './reactive'
import { type Ref, isRef } from './ref'
import { setActiveSub } from './system'
import { warn } from './warning'

// These errors were transferred from `packages/runtime-core/src/errorHandling.ts`
// to @vue/reactivity to allow co-location with the moved base watch logic, hence
// it is essential to keep these values unchanged.
export enum WatchErrorCodes {
  WATCH_GETTER = 2,
  WATCH_CALLBACK,
  WATCH_CLEANUP,
}

export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = Ref<T, any> | ComputedRef<T> | (() => T)

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup,
) => any

export type OnCleanup = (cleanupFn: () => void) => void

export interface WatchOptions<Immediate = boolean> extends DebuggerOptions {
  immediate?: Immediate
  deep?: boolean | number
  once?: boolean
  onWarn?: (msg: string, ...args: any[]) => void
  /**
   * @internal
   */
  call?: (
    fn: Function | Function[],
    type: WatchErrorCodes,
    args?: unknown[],
  ) => void
}

export type WatchStopHandle = () => void

export interface WatchHandle extends WatchStopHandle {
  pause: () => void
  resume: () => void
  stop: () => void
}

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

let activeWatcher: WatcherEffect | undefined = undefined

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
 * @param failSilently - if `true`, will not throw warning when called without
 * an active effect.
 * @param owner - The effect that this cleanup function should be attached to.
 * By default, the current active effect.
 */
export function onWatcherCleanup(
  cleanupFn: () => void,
  failSilently = false,
  owner: WatcherEffect | undefined = activeWatcher,
): void {
  if (owner) {
    const { call } = owner.options
    if (call) {
      owner.cleanups[owner.cleanupsLength++] = () =>
        call(cleanupFn, WatchErrorCodes.WATCH_CLEANUP)
    } else {
      owner.cleanups[owner.cleanupsLength++] = cleanupFn
    }
  } else if (__DEV__ && !failSilently) {
    warn(
      `onWatcherCleanup() was called when there was no active watcher` +
        ` to associate with.`,
    )
  }
}

export class WatcherEffect extends ReactiveEffect {
  forceTrigger: boolean
  isMultiSource: boolean
  oldValue: any
  boundCleanup: typeof onWatcherCleanup = fn =>
    onWatcherCleanup(fn, false, this)

  constructor(
    source: WatchSource | WatchSource[] | WatchEffect | object,
    public cb?: WatchCallback<any, any> | null | undefined,
    public options: WatchOptions = EMPTY_OBJ,
  ) {
    const { deep, once, call, onWarn } = options

    let getter: () => any
    let forceTrigger = false
    let isMultiSource = false

    if (isRef(source)) {
      getter = () => source.value
      forceTrigger = isShallow(source)
    } else if (isReactive(source)) {
      getter = () => reactiveGetter(source, deep)
      forceTrigger = true
    } else if (isArray(source)) {
      isMultiSource = true
      forceTrigger = source.some(s => isReactive(s) || isShallow(s))
      getter = () =>
        source.map(s => {
          if (isRef(s)) {
            return s.value
          } else if (isReactive(s)) {
            return reactiveGetter(s, deep)
          } else if (isFunction(s)) {
            return call ? call(s, WatchErrorCodes.WATCH_GETTER) : s()
          } else {
            __DEV__ && warnInvalidSource(s, onWarn)
          }
        })
    } else if (isFunction(source)) {
      if (cb) {
        // getter with cb
        getter = call
          ? () => call(source, WatchErrorCodes.WATCH_GETTER)
          : (source as () => any)
      } else {
        // no cb -> simple effect
        getter = () => {
          if (this.cleanupsLength) {
            const prevSub = setActiveSub()
            try {
              cleanup(this)
            } finally {
              setActiveSub(prevSub)
            }
          }
          const currentEffect = activeWatcher
          activeWatcher = this
          try {
            return call
              ? call(source, WatchErrorCodes.WATCH_CALLBACK, [
                  this.boundCleanup,
                ])
              : source(this.boundCleanup)
          } finally {
            activeWatcher = currentEffect
          }
        }
      }
    } else {
      getter = NOOP
      __DEV__ && warnInvalidSource(source, onWarn)
    }

    if (cb && deep) {
      const baseGetter = getter
      const depth = deep === true ? Infinity : deep
      getter = () => traverse(baseGetter(), depth)
    }

    super(getter)
    this.forceTrigger = forceTrigger
    this.isMultiSource = isMultiSource

    if (once && cb) {
      const _cb = cb
      cb = (...args) => {
        _cb(...args)
        this.stop()
      }
    }

    this.cb = cb

    this.oldValue = isMultiSource
      ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
      : INITIAL_WATCHER_VALUE

    if (__DEV__) {
      this.onTrack = options.onTrack
      this.onTrigger = options.onTrigger
    }
  }

  run(initialRun = false): void {
    const oldValue = this.oldValue
    const newValue = (this.oldValue = super.run())
    if (!this.cb) {
      return
    }
    const { immediate, deep, call } = this.options
    if (initialRun && !immediate) {
      return
    }
    if (
      deep ||
      this.forceTrigger ||
      (this.isMultiSource
        ? (newValue as any[]).some((v, i) => hasChanged(v, oldValue[i]))
        : hasChanged(newValue, oldValue))
    ) {
      // cleanup before running cb again
      cleanup(this)
      const currentWatcher = activeWatcher
      activeWatcher = this
      try {
        const args = [
          newValue,
          // pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE
            ? undefined
            : this.isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE
              ? []
              : oldValue,
          this.boundCleanup,
        ]
        call
          ? call(this.cb, WatchErrorCodes.WATCH_CALLBACK, args)
          : // @ts-expect-error
            this.cb(...args)
      } finally {
        activeWatcher = currentWatcher
      }
    }
  }
}

function reactiveGetter(source: object, deep: WatchOptions['deep']): unknown {
  // traverse will happen in wrapped getter below
  if (deep) return source
  // for `deep: false | 0` or shallow reactive, only traverse root-level properties
  if (isShallow(source) || deep === false || deep === 0)
    return traverse(source, 1)
  // for `deep: undefined` on a reactive object, deeply traverse all properties
  return traverse(source)
}

function warnInvalidSource(s: object, onWarn: WatchOptions['onWarn']): void {
  ;(onWarn || warn)(
    `Invalid watch source: `,
    s,
    `A watch source can only be a getter/effect function, a ref, ` +
      `a reactive object, or an array of these types.`,
  )
}

export function watch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb?: WatchCallback | null,
  options: WatchOptions = EMPTY_OBJ,
): WatchHandle {
  const effect = new WatcherEffect(source, cb, options)

  effect.run(true)

  const stop = effect.stop.bind(effect) as WatchHandle
  stop.pause = effect.pause.bind(effect)
  stop.resume = effect.resume.bind(effect)
  stop.stop = stop

  return stop
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
