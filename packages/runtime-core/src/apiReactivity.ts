export {
  ref,
  isRef,
  toRefs,
  reactive,
  isReactive,
  readonly,
  isReadonly,
  toRaw,
  markReadonly,
  markNonReactive,
  effect,
  // types
  ReactiveEffect,
  ReactiveEffectOptions,
  DebuggerEvent,
  OperationTypes,
  Ref,
  ComputedRef,
  UnwrapRef,
  WritableComputedOptions
} from '@vue/reactivity'

import {
  Ref,
  computed as _computed,
  ComputedRef,
  WritableComputedOptions,
  ReactiveEffect
} from '@vue/reactivity'

import { currentInstance } from './component'

// record effects created during a component's setup() so that they can be
// stopped when the component unmounts
export function recordEffect(effect: ReactiveEffect) {
  if (currentInstance) {
    ;(currentInstance.effects || (currentInstance.effects = [])).push(effect)
  }
}

export function computed<T>(getter: () => T): ComputedRef<T>
export function computed<T>(options: WritableComputedOptions<T>): Ref<T>
export function computed<T>(getterOrOptions: any) {
  const c = _computed(getterOrOptions)
  recordEffect(c.effect)
  return c
}
