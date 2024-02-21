import { isFunction } from '@vue/shared'
import {
  type DebuggerOptions,
  Dep,
  Flags,
  type Link,
  type ReactiveEffect,
  type Subscriber,
  refreshComputed,
} from './effect'
import type { Ref } from './ref'
import { warn } from './warning'

declare const ComputedRefSymbol: unique symbol

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
  [ComputedRefSymbol]: true
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect
}

export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export class ComputedRefImpl<T = any> implements Subscriber {
  // A computed is a ref
  _value: any = undefined
  dep: Dep
  // A computed is also a subscriber that tracks other deps
  deps?: Link = undefined
  // track variaous states
  flags = Flags.DIRTY

  constructor(
    public getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T> | undefined,
    // @ts-expect-error TODO
    private isSSR: boolean,
  ) {
    this.dep = new Dep(this)
  }

  notify() {
    if (!(this.flags & Flags.NOTIFIED)) {
      this.flags |= Flags.DIRTY | Flags.NOTIFIED
      this.dep.notify()
    }
  }

  get value() {
    const link = this.dep.track()
    refreshComputed(this)
    // sync version after evaluation
    if (link) {
      link.version = this.dep.version
    }
    return this._value
  }

  set value(newValue) {
    if (this._setter) {
      this._setter(newValue)
    } else if (__DEV__) {
      warn('Write operation failed: computed value is readonly')
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
export function computed<T>(
  options: WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
): WritableComputedRef<T>
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

  // TODO
  if (__DEV__ && debugOptions && !isSSR) {
    // cRef.effect.onTrack = debugOptions.onTrack
    // cRef.effect.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}
