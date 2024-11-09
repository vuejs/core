import { isFunction } from '@vue/shared'
import {
  Dependency,
  DirtyLevels,
  IComputed,
  Link,
  Subscriber,
  System,
} from 'alien-signals'
import { ReactiveFlags, TrackOpTypes } from './constants'
import { onTrack, onTrigger } from './debug'
import type { DebuggerEvent, DebuggerOptions } from './effect'
import type { Ref } from './ref'
import { warn } from './warning'

declare const ComputedRefSymbol: unique symbol
declare const WritableComputedRefSymbol: unique symbol

interface BaseComputedRef<T, S = T> extends Ref<T, S> {
  [ComputedRefSymbol]: true
  /**
   * @deprecated computed no longer uses effect
   */
  effect: ComputedRefImpl
}

export interface ComputedRef<T = any> extends BaseComputedRef<T> {
  readonly value: T
}

export interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
  [WritableComputedRefSymbol]: true
}

export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

export interface WritableComputedOptions<T, S = T> {
  get: ComputedGetter<T>
  set: ComputedSetter<S>
}

/**
 * @private exported by @vue/reactivity for Vue core use, but not exported from
 * the main vue package
 */
export class ComputedRefImpl<T = any> implements IComputed {
  _value: T | undefined = undefined

  // Dependency
  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined
  linkedTrackId = 0

  // Subscriber
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  trackId = 0
  _dirtyLevel: DirtyLevels = 3 satisfies DirtyLevels.Dirty
  canPropagate = false

  /**
   * @internal
   */
  readonly __v_isRef = true
  // TODO isolatedDeclarations ReactiveFlags.IS_REF
  /**
   * @internal
   */
  readonly __v_isReadonly: boolean

  // dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void

  /**
   * Dev only
   * @internal
   */
  _warnRecursive?: boolean

  constructor(
    public fn: ComputedGetter<T>,
    private readonly setter: ComputedSetter<T> | undefined,
    public isSSR: boolean,
  ) {
    this[ReactiveFlags.IS_READONLY] = !setter
  }

  get dirtyLevel(): DirtyLevels {
    return this._dirtyLevel
  }

  set dirtyLevel(value: DirtyLevels) {
    if (
      __DEV__ &&
      value > (0 satisfies DirtyLevels.None) &&
      value < (4 satisfies DirtyLevels.Released)
    ) {
      onTrigger(this)
    }
    this._dirtyLevel = value
  }

  get value(): T {
    const dirtyLevel = this.dirtyLevel
    if (dirtyLevel === (2 satisfies DirtyLevels.MaybeDirty)) {
      Subscriber.resolveMaybeDirty(this)
      if (this.dirtyLevel === (3 satisfies DirtyLevels.Dirty)) {
        this.update()
      }
    } else if (
      dirtyLevel === (3 satisfies DirtyLevels.Dirty) ||
      dirtyLevel === (4 satisfies DirtyLevels.Released)
    ) {
      this.update()
    }
    const activeTrackId = System.activeTrackId
    if (activeTrackId !== 0 && this.linkedTrackId !== activeTrackId) {
      this.linkedTrackId = activeTrackId
      if (__DEV__) {
        onTrack(System.activeSub!, {
          target: this,
          type: TrackOpTypes.GET,
          key: 'value',
        })
      }
      Dependency.linkSubscriber(this, System.activeSub!)
    }
    return this._value!
  }

  set value(newValue) {
    if (this.setter) {
      this.setter(newValue)
    } else if (__DEV__) {
      warn('Write operation failed: computed value is readonly')
    }
  }

  update(): void {
    const prevSub = Subscriber.startTrackDependencies(this)
    const oldValue = this._value
    let newValue: T
    try {
      newValue = this.fn(oldValue)
    } finally {
      Subscriber.endTrackDependencies(this, prevSub)
    }
    if (oldValue !== newValue) {
      this._value = newValue
      const subs = this.subs
      if (subs !== undefined) {
        Dependency.propagate(subs)
      }
    }
  }
}

/**
 * Takes a getter function and returns a readonly reactive ref object for the
 * returned value from the getter. It can also take an object with get and set
 * functions to create a writable ref object.
 *
 * @example
 * ```js
 * // Creating a readonly computed ref:
 * const count = ref(1)
 * const plusOne = computed(() => count.value + 1)
 *
 * console.log(plusOne.value) // 2
 * plusOne.value++ // error
 * ```
 *
 * ```js
 * // Creating a writable computed ref:
 * const count = ref(1)
 * const plusOne = computed({
 *   get: () => count.value + 1,
 *   set: (val) => {
 *     count.value = val - 1
 *   }
 * })
 *
 * plusOne.value = 1
 * console.log(count.value) // 0
 * ```
 *
 * @param getter - Function that produces the next value.
 * @param debugOptions - For debugging. See {@link https://vuejs.org/guide/extras/reactivity-in-depth.html#computed-debugging}.
 * @see {@link https://vuejs.org/api/reactivity-core.html#computed}
 */
export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions,
): ComputedRef<T>
export function computed<T, S = T>(
  options: WritableComputedOptions<T, S>,
  debugOptions?: DebuggerOptions,
): WritableComputedRef<T, S>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false,
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T> | undefined

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  const cRef = new ComputedRefImpl(getter, setter, isSSR)

  if (__DEV__ && debugOptions && !isSSR) {
    cRef.onTrack = debugOptions.onTrack
    cRef.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}
