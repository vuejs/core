import { hasChanged, isFunction } from '@vue/shared'
import { ReactiveFlags, TrackOpTypes } from './constants'
import { onTrack, setupOnTrigger } from './debug'
import type { DebuggerEvent, DebuggerOptions } from './effect'
import { activeEffectScope } from './effectScope'
import type { Ref } from './ref'
import {
  type Link,
  type ReactiveNode,
  ReactiveFlags as SystemReactiveFlags,
  activeSub,
  checkDirty,
  endTracking,
  link,
  shallowPropagate,
  startTracking,
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
export class ComputedRefImpl<T = any> implements ReactiveNode {
  /**
   * @internal
   */
  _value: T | undefined = undefined

  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  flags: SystemReactiveFlags =
    SystemReactiveFlags.Mutable | SystemReactiveFlags.Dirty

  /**
   * @internal
   */
  readonly __v_isRef = true
  // TODO isolatedDeclarations ReactiveFlags.IS_REF
  /**
   * @internal
   */
  readonly __v_isReadonly: boolean
  // TODO isolatedDeclarations ReactiveFlags.IS_READONLY

  // for backwards compat
  get effect(): this {
    return this
  }
  // for backwards compat
  get dep(): ReactiveNode {
    return this
  }
  /**
   * @internal
   * for backwards compat
   */
  get _dirty(): boolean {
    const flags = this.flags
    if (flags & SystemReactiveFlags.Dirty) {
      return true
    }
    if (flags & SystemReactiveFlags.Pending) {
      if (checkDirty(this.deps!, this)) {
        this.flags = flags | SystemReactiveFlags.Dirty
        return true
      } else {
        this.flags = flags & ~SystemReactiveFlags.Pending
      }
    }
    return false
  }
  /**
   * @internal
   * for backwards compat
   */
  set _dirty(v: boolean) {
    if (v) {
      this.flags |= SystemReactiveFlags.Dirty
    } else {
      this.flags &= ~(SystemReactiveFlags.Dirty | SystemReactiveFlags.Pending)
    }
  }

  // dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void

  constructor(
    public fn: ComputedGetter<T>,
    private readonly setter: ComputedSetter<T> | undefined,
  ) {
    this[ReactiveFlags.IS_READONLY] = !setter
  }

  get value(): T {
    const flags = this.flags
    if (
      flags & SystemReactiveFlags.Dirty ||
      (flags & SystemReactiveFlags.Pending && checkDirty(this.deps!, this))
    ) {
      if (this.update()) {
        const subs = this.subs
        if (subs !== undefined) {
          shallowPropagate(subs)
        }
      }
    } else if (flags & SystemReactiveFlags.Pending) {
      this.flags = flags & ~SystemReactiveFlags.Pending
    }
    if (activeSub !== undefined) {
      if (__DEV__) {
        onTrack(activeSub!, {
          target: this,
          type: TrackOpTypes.GET,
          key: 'value',
        })
      }
      link(this, activeSub)
    } else if (activeEffectScope !== undefined) {
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
    const prevSub = startTracking(this)
    try {
      const oldValue = this._value
      const newValue = this.fn(oldValue)
      if (hasChanged(oldValue, newValue)) {
        this._value = newValue
        return true
      }
      return false
    } finally {
      endTracking(this, prevSub)
    }
  }
}

if (__DEV__) {
  setupOnTrigger(ComputedRefImpl)
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
