import {
  Ref,
  UnwrapRef,
  ShallowUnwrapRef,
  ComputedRef,
  WritableComputedOptions,
  DebuggerOptions,
  WritableComputedRef
} from '@vue/reactivity'

export function $ref<T>(arg: T | Ref<T>): UnwrapRef<T>
export function $ref() {}

export function $shallowRef<T>(arg: T): T {
  return arg
}

declare const ComputedRefMarker: unique symbol
type ComputedValue<T> = T & { [ComputedRefMarker]?: any }

declare const WritableComputedRefMarker: unique symbol
type WritableComputedValue<T> = T & { [WritableComputedRefMarker]?: any }

export function $computed<T>(
  getter: () => T,
  debuggerOptions?: DebuggerOptions
): ComputedValue<T>
export function $computed<T>(
  options: WritableComputedOptions<T>,
  debuggerOptions?: DebuggerOptions
): WritableComputedValue<T>
export function $computed() {}

export function $fromRefs<T>(source: T): ShallowUnwrapRef<T>
export function $fromRefs() {
  return null as any
}

export function $raw<T>(value: ComputedValue<T>): ComputedRef<T>
export function $raw<T>(value: WritableComputedValue<T>): WritableComputedRef<T>
export function $raw<T>(value: T): Ref<T>
export function $raw() {
  return null as any
}
