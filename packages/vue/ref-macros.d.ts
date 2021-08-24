import {
  Ref,
  UnwrapRef,
  ComputedRef,
  WritableComputedOptions,
  DebuggerOptions,
  WritableComputedRef,
  ShallowUnwrapRef
} from '@vue/runtime-dom'

declare const RefMarker: unique symbol
type RefValue<T> = T & { [RefMarker]?: any }

declare const ComputedRefMarker: unique symbol
type ComputedRefValue<T> = T & { [ComputedRefMarker]?: any }

declare const WritableComputedRefMarker: unique symbol
type WritableComputedRefValue<T> = T & { [WritableComputedRefMarker]?: any }

/**
 * Vue ref transform macro for binding refs as reactive variables.
 */
declare function _$<T>(arg: ComputedRef<T>): ComputedRefValue<T>
declare function _$<T>(arg: WritableComputedRef<T>): WritableComputedRefValue<T>
declare function _$<T>(arg: Ref<T>): RefValue<T>
declare function _$<T extends object>(arg?: T): ShallowUnwrapRef<T>

/**
 * Vue ref transform macro for accessing underlying refs of reactive varaibles.
 */
declare function _$$<T>(value: T): ComputedRef<T>
declare function _$$<T>(
  value: WritableComputedRefValue<T>
): WritableComputedRef<T>
declare function _$$<T>(value: RefValue<T>): Ref<T>
declare function _$$<T extends object>(arg: T): ToRawRefs<T>

type ToRawRefs<T extends object> = {
  [K in keyof T]: T[K] extends ComputedRefValue<infer V>
    ? ComputedRefValue<V>
    : T[K] extends WritableComputedRefValue<infer V>
    ? WritableComputedRef<V>
    : T[K] extends RefValue<infer V>
    ? Ref<V>
    : T[K] extends object
    ? T[K] extends
        | Function
        | Map<any, any>
        | Set<any>
        | WeakMap<any, any>
        | WeakSet<any>
      ? T[K]
      : ToRawRefs<T[K]>
    : T[K]
}

declare function _$ref<T>(arg?: T | Ref<T>): RefValue<UnwrapRef<T>>

declare function _$shallowRef<T>(arg?: T): RefValue<T>

declare function _$computed<T>(
  getter: () => T,
  debuggerOptions?: DebuggerOptions
): ComputedRefValue<T>
declare function _$computed<T>(
  options: WritableComputedOptions<T>,
  debuggerOptions?: DebuggerOptions
): WritableComputedRefValue<T>

declare global {
  const $: typeof _$
  const $$: typeof _$$
  const $ref: typeof _$ref
  const $shallowRef: typeof _$shallowRef
  const $computed: typeof _$computed
}
