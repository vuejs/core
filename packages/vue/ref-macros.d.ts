import {
  Ref,
  UnwrapRef,
  ComputedRef,
  WritableComputedOptions,
  DebuggerOptions,
  WritableComputedRef
} from '@vue/runtime-dom'

declare const RefType: unique symbol

declare const enum RefTypes {
  Ref = 1,
  ComputedRef = 2,
  WritableComputedRef = 3
}

type RefValue<T> = T extends null | undefined
  ? T
  : T & { [RefType]?: RefTypes.Ref }

type ComputedRefValue<T> = T extends null | undefined
  ? T
  : T & { [RefType]?: RefTypes.ComputedRef }

type WritableComputedRefValue<T> = T extends null | undefined
  ? T
  : T & { [RefType]?: RefTypes.WritableComputedRef }

type NormalObject<T extends object> = T & { [RefType]?: never }

/**
 * Vue ref transform macro for binding refs as reactive variables.
 */
declare function _$<T>(arg: ComputedRef<T>): ComputedRefValue<T>
declare function _$<T>(arg: WritableComputedRef<T>): WritableComputedRefValue<T>
declare function _$<T>(arg: Ref<T>): RefValue<T>
declare function _$<T extends object>(arg?: T): DestructureRefs<T>

type DestructureRefs<T extends object> = {
  [K in keyof T]: T[K] extends ComputedRef<infer V>
    ? ComputedRefValue<V>
    : T[K] extends WritableComputedRef<infer V>
    ? WritableComputedRefValue<V>
    : T[K] extends Ref<infer V>
    ? RefValue<V>
    : T[K]
}

/**
 * Vue ref transform macro for accessing underlying refs of reactive varaibles.
 */
declare function _$$<T extends object>(arg: NormalObject<T>): ToRawRefs<T>
declare function _$$<T>(value: RefValue<T>): Ref<T>
declare function _$$<T>(value: ComputedRefValue<T>): ComputedRef<T>
declare function _$$<T>(
  value: WritableComputedRefValue<T>
): WritableComputedRef<T>

type ToRawRefs<T extends object> = {
  [K in keyof T]: T[K] extends RefValue<infer V>
    ? Ref<V>
    : T[K] extends ComputedRefValue<infer V>
    ? ComputedRef<V>
    : T[K] extends WritableComputedRefValue<infer V>
    ? WritableComputedRef<V>
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
