export {
  ref,
  isRef,
  reactive,
  isReactive,
  immutable,
  isImmutable,
  toRaw,
  markImmutable,
  markNonReactive,
  effect,
  // types
  ReactiveEffect,
  ReactiveEffectOptions,
  DebuggerEvent,
  OperationTypes,
  Ref,
  ComputedRef,
  UnwrapRef
} from '@vue/reactivity'

import {
  computed as _computed,
  ComputedRef,
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

// a wrapped version of raw computed to tear it down at component unmount
export function computed<T, C = null>(
  getter: () => T,
  setter?: (v: T) => void
): ComputedRef<T> {
  const c = _computed(getter, setter)
  recordEffect(c.effect)
  return c
}
