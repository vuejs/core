import {
  computed as _computed,
  ComputedGetter,
  ComputedRef,
  stop,
  WritableComputedOptions,
  WritableComputedRef
} from '@vue/reactivity'
import { recordInstanceBoundEffect } from './component'
import { warn } from './warning'

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  const c = _computed(getterOrOptions as any)
  recordInstanceBoundEffect(c.effect)
  return c
}

export interface StaticComputedRef<T> extends ComputedRef<T> {
  stop: () => void
}

export interface StaticWritableComputedRef<T> extends WritableComputedRef<T> {
  stop: () => void
}

export function staticComputed<T>(
  getter: ComputedGetter<T>
): StaticComputedRef<T>
export function staticComputed<T>(
  options: WritableComputedOptions<T>
): StaticWritableComputedRef<T>
export function staticComputed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  if (__DEV__) {
    warn(
      'note that static life computed value must be stopped manually ' +
        'to prevent memory leaks.'
    )
  }

  const c = _computed(getterOrOptions as any) as any
  c.stop = () => {
    stop(c.effect)
  }
  return c
}
