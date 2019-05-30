import { track, trigger } from './effect'
import { OperationTypes } from './operations'
import { isObject } from '@vue/shared'
import { observable } from './index'

export const knownValues = new WeakSet()

export interface Value<T> {
  value: T
}

const convert = (val: any): any => (isObject(val) ? observable(val) : val)

export function value<T>(raw: T): Value<T> {
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
  return v
}

export function isValue(v: any): v is Value<any> {
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
export type UnwrapValue<T> = T extends Value<infer V>
  ? UnwrapValue2<V>
  : T extends Array<infer V>
    ? Array<UnwrapValue2<V>>
    : T extends BailTypes
      ? T // bail out on types that shouldn't be unwrapped
      : T extends object ? { [K in keyof T]: UnwrapValue2<T[K]> } : T

type UnwrapValue2<T> = T extends Value<infer V>
  ? UnwrapValue3<V>
  : T extends Array<infer V>
    ? Array<UnwrapValue3<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapValue3<T[K]> } : T

type UnwrapValue3<T> = T extends Value<infer V>
  ? UnwrapValue4<V>
  : T extends Array<infer V>
    ? Array<UnwrapValue4<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapValue4<T[K]> } : T

type UnwrapValue4<T> = T extends Value<infer V>
  ? UnwrapValue5<V>
  : T extends Array<infer V>
    ? Array<UnwrapValue5<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapValue5<T[K]> } : T

type UnwrapValue5<T> = T extends Value<infer V>
  ? UnwrapValue6<V>
  : T extends Array<infer V>
    ? Array<UnwrapValue6<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapValue6<T[K]> } : T

type UnwrapValue6<T> = T extends Value<infer V>
  ? UnwrapValue7<V>
  : T extends Array<infer V>
    ? Array<UnwrapValue7<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapValue7<T[K]> } : T

type UnwrapValue7<T> = T extends Value<infer V>
  ? UnwrapValue8<V>
  : T extends Array<infer V>
    ? Array<UnwrapValue8<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapValue8<T[K]> } : T

type UnwrapValue8<T> = T extends Value<infer V>
  ? UnwrapValue9<V>
  : T extends Array<infer V>
    ? Array<UnwrapValue9<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapValue9<T[K]> } : T

type UnwrapValue9<T> = T extends Value<infer V>
  ? UnwrapValue10<V>
  : T extends Array<infer V>
    ? Array<UnwrapValue10<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapValue10<T[K]> } : T

type UnwrapValue10<T> = T extends Value<infer V>
  ? V // stop recursion
  : T
