import {
  Ref,
  UnwrapRef,
  ShallowUnwrapRef,
  ComputedRef,
  WritableComputedOptions,
  DebuggerOptions,
  WritableComputedRef
} from '@vue/reactivity'

declare const RefMarker: unique symbol
type RefValue<T> = T & { [RefMarker]?: any }

export function $ref<T>(arg?: T | Ref<T>): RefValue<UnwrapRef<T>>
export function $ref() {}

export function $shallowRef<T>(arg?: T): RefValue<T>
export function $shallowRef() {}

declare const ComputedRefMarker: unique symbol
type ComputedRefValue<T> = T & { [ComputedRefMarker]?: any }

declare const WritableComputedRefMarker: unique symbol
type WritableComputedRefValue<T> = T & { [WritableComputedRefMarker]?: any }

export function $computed<T>(
  getter: () => T,
  debuggerOptions?: DebuggerOptions
): ComputedRefValue<T>
export function $computed<T>(
  options: WritableComputedOptions<T>,
  debuggerOptions?: DebuggerOptions
): WritableComputedRefValue<T>
export function $computed() {}

export function $fromRefs<T>(source: T): ShallowUnwrapRef<T>
export function $fromRefs() {
  return null as any
}

export function $raw<T extends ComputedRefValue<any>>(
  value: T
): T extends ComputedRefValue<infer V> ? ComputedRef<V> : never
export function $raw<T>(
  value: WritableComputedRefValue<T>
): WritableComputedRef<T>
export function $raw<T>(value: RefValue<T>): Ref<T>
export function $raw() {
  return null as any
}
