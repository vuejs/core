import { Ref, UnwrapRef, ShallowUnwrapRef, ComputedRef } from '@vue/reactivity'

export function $ref<T>(arg: T | Ref<T>): UnwrapRef<T>
export function $ref() {}

export function $shallowRef<T>(arg: T): T {
  return arg
}

declare const ComputedRefMarker: unique symbol
type ComputedRefValue<T> = T & { [ComputedRefMarker]?: any }

export function $computed<T>(getter: () => T): ComputedRefValue<T>
export function $computed() {}

export function $fromRefs<T>(source: T): ShallowUnwrapRef<T>
export function $fromRefs() {
  return null as any
}

export function $raw<T>(value: ComputedRefValue<T>): ComputedRef<T>
export function $raw<T>(value: T): Ref<T>
export function $raw() {
  return null as any
}
