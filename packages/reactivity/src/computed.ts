import { DebuggerOptions, ReactiveEffect } from './effect'
import { Ref, trackRefValue, triggerRefValue } from './ref'
import { hasChanged, isFunction, NOOP } from '@vue/shared'
import { ReactiveFlags, toRaw } from './reactive'
import { Dep } from './dep'

declare const ComputedRefSymbol: unique symbol

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
  [ComputedRefSymbol]: true
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>
}

export type ComputedGetter<T> = (...args: any[]) => T
export type ComputedSetter<T> = (v: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export class ComputedRefImpl<T> {
  public dep?: Dep = undefined

  private _value!: T
  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true
  public readonly [ReactiveFlags.IS_READONLY]: boolean = false

  public _cacheable: boolean

  private scheduled = false

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean,
    isSSR: boolean
  ) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this.scheduled) {
        this.scheduled = true
        triggerRefValue(this, this)
      }
    })
    this.effect.dirty = true
    this.effect.computed = this
    this.effect.active = this._cacheable = !isSSR
    this[ReactiveFlags.IS_READONLY] = isReadonly
  }

  get value() {
    // the computed ref may get wrapped by other proxies e.g. readonly() #3376
    const self = toRaw(this)
    trackRefValue(self)
    if (!self._cacheable || self.effect.dirty) {
      const newValue = self.effect.run()!
      if (hasChanged(self._value, newValue)) {
        triggerRefValue(self, undefined)
      }
      self._value = newValue
      self.scheduled = false
      self.effect.dirty = false
    }
    return self._value
  }

  set value(newValue: T) {
    this._setter(newValue)
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
  debugOptions?: DebuggerOptions
): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>

  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    getter = getterOrOptions
    setter = __DEV__
      ? () => {
          console.warn('Write operation failed: computed value is readonly')
        }
      : NOOP
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  const cRef = new ComputedRefImpl(getter, setter, onlyGetter || !setter, isSSR)

  if (__DEV__ && debugOptions && !isSSR) {
    cRef.effect.onTrack = debugOptions.onTrack
    cRef.effect.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}
