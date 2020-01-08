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
  TrackOpTypes,
  TriggerOpTypes,
  Ref,
  ComputedRef,
  UnwrapRef,
  WritableComputedOptions
} from '@vue/reactivity'

import {
  computed as _computed,
  ComputedRef,
  WritableComputedOptions,
  ReactiveEffect,
  WritableComputedRef,
  ComputedGetter
} from '@vue/reactivity'

import { currentInstance } from './component'

// record effects created during a component's setup() so that they can be
// stopped when the component unmounts
export function recordEffect(effect: ReactiveEffect): (() => void) | void {
  if (currentInstance) {
    const effects = currentInstance.effects || (currentInstance.effects = [])
    effects.push(effect)
    return () => {
      const index = effects.indexOf(effect)
      if (index !== -1) {
        effects.splice(index, 1)
      }
    }
  }
}

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  const c = _computed(getterOrOptions as any)
  recordEffect(c.effect)
  return c
}
