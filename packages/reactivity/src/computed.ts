import { hasChanged, isFunction } from '@vue/shared'
import { ReactiveFlags, TrackOpTypes } from './constants'
import { onTrack, setupFlagsHandler } from './debug'
import {
  type DebuggerEvent,
  type DebuggerOptions,
  activeSub,
  activeTrackId,
  nextTrackId,
  setActiveSub,
} from './effect'
import { activeEffectScope } from './effectScope'
import type { Ref } from './ref'
import {
  type Dependency,
  type IComputed,
  type Link,
  SubscriberFlags,
  checkDirty,
  endTrack,
  link,
  startTrack,
} from './system'
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
  /**
   * @internal
   */
  _value: T | undefined = undefined
  version = 0

  // Dependency
  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined
  lastTrackedId = 0

  // Subscriber
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  flags: SubscriberFlags = SubscriberFlags.Dirty

  /**
   * @internal
   */
  get __v_isRef() {
    return true
  }
  // TODO isolatedDeclarations ReactiveFlags.IS_REF
  /**
   * @internal
   */
  readonly __v_isReadonly: boolean
  // TODO isolatedDeclarations ReactiveFlags.IS_READONLY

  /**
   * for backwards compat
   * @internal
   */
  get dep(): Dependency {
    return this
  }
  /**
   * for backwards compat
   * @internal
   */
  get _dirty(): boolean {
    const flags = this.flags
    if (flags & SubscriberFlags.Dirty) {
      return true
    } else if (flags & SubscriberFlags.ToCheckDirty) {
      if (checkDirty(this.deps!)) {
        this.flags |= SubscriberFlags.Dirty
        return true
      } else {
        this.flags &= ~SubscriberFlags.ToCheckDirty
        return false
      }
    }
    return false
  }
  set _dirty(v: boolean) {
    if (v) {
      this.flags |= SubscriberFlags.Dirty
    } else {
      this.flags &= ~SubscriberFlags.Dirtys
    }
  }

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
  ) {
    this[ReactiveFlags.IS_READONLY] = !setter
    if (__DEV__) {
      setupFlagsHandler(this)
    }
  }

  get value(): T {
    if (this._dirty) {
      this.update()
    }
    if (activeTrackId !== 0 && this.lastTrackedId !== activeTrackId) {
      if (__DEV__) {
        onTrack(activeSub!, {
          target: this,
          type: TrackOpTypes.GET,
          key: 'value',
        })
      }
      this.lastTrackedId = activeTrackId
      link(this, activeSub!).version = this.version
    } else if (
      activeEffectScope !== undefined &&
      this.lastTrackedId !== activeEffectScope.trackId
    ) {
      link(this, activeEffectScope)
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

  update(): boolean {
    const prevSub = activeSub
    const prevTrackId = activeTrackId
    setActiveSub(this, nextTrackId())
    startTrack(this)
    const oldValue = this._value
    let newValue: T
    try {
      newValue = this.fn(oldValue)
    } finally {
      setActiveSub(prevSub, prevTrackId)
      endTrack(this)
    }
    if (hasChanged(oldValue, newValue)) {
      this._value = newValue
      this.version++
      return true
    }
    return false
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

  const cRef = new ComputedRefImpl(getter, setter)

  if (__DEV__ && debugOptions && !isSSR) {
    cRef.onTrack = debugOptions.onTrack
    cRef.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}
