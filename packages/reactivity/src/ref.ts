import { track, trigger } from './effect'
import { OperationTypes } from './operations'
import { isObject } from '@vue/shared'
import { reactive } from './reactive'

export const knownValues = new WeakSet()

export interface Ref<T> {
  value: T extends Ref<infer V> ? Ref<V> : UnwrapRef<T>
}

const convert = (val: any): any => (isObject(val) ? reactive(val) : val)

export function ref<T>(raw: T): Ref<T> {
  raw = convert(raw)
  const v = {
    get value() {
      track(v, OperationTypes.GET, '')
      return raw
    },
    set value(newVal) {
      raw = convert(newVal)
      trigger(v, OperationTypes.SET, '')
    }
  }
  knownValues.add(v)
  return v as any
}

export function isRef(v: any): v is Ref<any> {
  return knownValues.has(v)
}

type BailTypes =
  | Function
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>

// Recursively unwraps nested value bindings.
// Unfortunately TS cannot do recursive types, but this should be enough for
// practical use cases...
export type UnwrapRef<T> = T extends Ref<infer V>
  ? UnwrapRef2<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef2<V>>
    : T extends BailTypes
      ? T // bail out on types that shouldn't be unwrapped
      : T extends object ? { [K in keyof T]: UnwrapRef2<T[K]> } : T

type UnwrapRef2<T> = T extends Ref<infer V>
  ? UnwrapRef3<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef3<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef3<T[K]> } : T

type UnwrapRef3<T> = T extends Ref<infer V>
  ? UnwrapRef4<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef4<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef4<T[K]> } : T

type UnwrapRef4<T> = T extends Ref<infer V>
  ? UnwrapRef5<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef5<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef5<T[K]> } : T

type UnwrapRef5<T> = T extends Ref<infer V>
  ? UnwrapRef6<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef6<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef6<T[K]> } : T

type UnwrapRef6<T> = T extends Ref<infer V>
  ? UnwrapRef7<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef7<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef7<T[K]> } : T

type UnwrapRef7<T> = T extends Ref<infer V>
  ? UnwrapRef8<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef8<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef8<T[K]> } : T

type UnwrapRef8<T> = T extends Ref<infer V>
  ? UnwrapRef9<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef9<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef9<T[K]> } : T

type UnwrapRef9<T> = T extends Ref<infer V>
  ? UnwrapRef10<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef10<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef10<T[K]> } : T

type UnwrapRef10<T> = T extends Ref<infer V>
  ? V // stop recursion
  : T
