import { ReactiveEffect } from './effect'
import { Ref, trackRefValue, triggerRefValue } from './ref'
import { isFunction, NOOP } from '@vue/shared'
import { ReactiveFlags, toRaw } from './reactive'
import { Dep } from './dep'

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>
}

export type ComputedGetter<T> = (ctx?: any) => T
export type ComputedSetter<T> = (v: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

type ComputedScheduler = (fn: () => void) => void
let scheduler: ComputedScheduler | undefined

/**
 * Set a scheduler for deferring computed computations
 */
export const setComputedScheduler = (s: ComputedScheduler | undefined) => {
  scheduler = s
}

class ComputedRefImpl<T> {
  public dep?: Dep = undefined

  private _value!: T
  private _dirty = true
  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]: boolean

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean
  ) {
    let compareTarget: any
    let hasCompareTarget = false
    let scheduled = false
    this.effect = new ReactiveEffect(getter, (computedTrigger?: boolean) => {
      if (scheduler && this.dep) {
        if (computedTrigger) {
          compareTarget = this._value
          hasCompareTarget = true
        } else if (!scheduled) {
          const valueToCompare = hasCompareTarget ? compareTarget : this._value
          scheduled = true
          hasCompareTarget = false
          scheduler(() => {
            if (this._get() !== valueToCompare) {
              triggerRefValue(this)
            }
            scheduled = false
          })
        }
        // chained upstream computeds are notified synchronously to ensure
        // value invalidation in case of sync access; normal effects are
        // deferred to be triggered in scheduler.
        for (const e of this.dep) {
          if (e.computed) {
            e.scheduler!(true /* computedTrigger */)
          }
        }
      }
      if (!this._dirty) {
        this._dirty = true
        if (!scheduler) triggerRefValue(this)
      }
    })
    this.effect.computed = true
    this[ReactiveFlags.IS_READONLY] = isReadonly
  }

  private _get() {
    if (this._dirty) {
      this._dirty = false
      return (this._value = this.effect.run()!)
    }
    return this._value
  }

  get value() {
    trackRefValue(this)
    // the computed ref may get wrapped by other proxies e.g. readonly() #3376
    return toRaw(this)._get()
  }

  set value(newValue: T) {
    this._setter(newValue)
  }
}

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>

  if (isFunction(getterOrOptions)) {
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

  return new ComputedRefImpl(
    getter,
    setter,
    isFunction(getterOrOptions) || !getterOrOptions.set
  ) as any
}
