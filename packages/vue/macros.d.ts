import type {
  ComputedRef,
  CustomRefFactory,
  DebuggerOptions,
  Ref,
  UnwrapRef,
  WritableComputedOptions,
  WritableComputedRef,
} from '@vue/runtime-dom'

export declare const RefType: unique symbol

export declare enum RefTypes {
  Ref = 1,
  ComputedRef = 2,
  WritableComputedRef = 3,
}

type RefValue<T> = T extends null | undefined ? T : ReactiveVariable<T>

type ReactiveVariable<T> = T & { [RefType]?: RefTypes.Ref }

type ComputedRefValue<T> = T extends null | undefined ? T : ComputedVariable<T>

type ComputedVariable<T> = T & { [RefType]?: RefTypes.ComputedRef }

type WritableComputedRefValue<T> = T extends null | undefined
  ? T
  : WritableComputedVariable<T>

type WritableComputedVariable<T> = T & {
  [RefType]?: RefTypes.WritableComputedRef
}

type NormalObject<T extends object> = T & { [RefType]?: never }

/**
 * Vue ref transform macro for binding refs as reactive variables.
 */
export declare function $<T>(arg: ComputedRef<T>): ComputedRefValue<T>
export declare function $<T>(
  arg: WritableComputedRef<T>,
): WritableComputedRefValue<T>
export declare function $<T>(arg: Ref<T>): RefValue<T>
export declare function $<T extends object>(arg?: T): DestructureRefs<T>

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
 * Vue ref transform macro for accessing underlying refs of reactive variables.
 */
export declare function $$<T extends object>(arg: NormalObject<T>): ToRawRefs<T>
export declare function $$<T>(value: RefValue<T>): Ref<T>
export declare function $$<T>(value: ComputedRefValue<T>): ComputedRef<T>
export declare function $$<T>(
  value: WritableComputedRefValue<T>,
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

export declare function $ref<T>(): RefValue<T | undefined>
export declare function $ref<T>(arg: T | Ref<T>): RefValue<UnwrapRef<T>>

export declare function $shallowRef<T>(): RefValue<T | undefined>
export declare function $shallowRef<T>(arg: T): RefValue<T>

export declare function $toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
): RefValue<T[K]>

export declare function $toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K],
): RefValue<Exclude<T[K], undefined>>

export declare function $customRef<T>(factory: CustomRefFactory<T>): RefValue<T>

export declare function $computed<T>(
  getter: () => T,
  debuggerOptions?: DebuggerOptions,
): ComputedRefValue<T>
export declare function $computed<T>(
  options: WritableComputedOptions<T>,
  debuggerOptions?: DebuggerOptions,
): WritableComputedRefValue<T>
