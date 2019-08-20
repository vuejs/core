export {
  ref,
  isRef,
  toRefs,
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
import { isFunction } from '@vue/shared'

// record effects created during a component's setup() so that they can be
// stopped when the component unmounts
export function recordEffect(effect: ReactiveEffect) {
  if (currentInstance) {
    ;(currentInstance.effects || (currentInstance.effects = [])).push(effect)
  }
}

interface ComputedOptions<T> {
  get: () => T
  set: (v: T) => void
}

export function computed<T>(
  getterOrOptions: (() => T) | ComputedOptions<T>
): ComputedRef<T> {
  let c: ComputedRef<T>
  if (isFunction(getterOrOptions)) {
    c = _computed(getterOrOptions)
  } else {
    c = _computed(getterOrOptions.get, getterOrOptions.set)
  }
  recordEffect(c.effect)
  return c
}
