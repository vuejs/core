import { track, trigger } from './effect'
import { OperationTypes } from './operations'
import { isObject } from '@vue/shared'
import { reactive } from './reactive'

export const refSymbol = Symbol(__DEV__ ? 'refSymbol' : '')

export interface Ref<T = any> {
  [refSymbol]: true
  value: UnwrapRef<T>
}

const convert = (val: any): any => (isObject(val) ? reactive(val) : val)

export function ref<T extends Ref>(raw: T): T
export function ref<T>(raw: T): Ref<T>
export function ref(raw: any) {
  if (isRef(raw)) {
    return raw
  }
  raw = convert(raw)
  const v = {
    [refSymbol]: true,
    get value() {
      track(v, OperationTypes.GET, '')
      return raw
    },
    set value(newVal) {
      raw = convert(newVal)
      trigger(v, OperationTypes.SET, '')
    }
  }
  return v as Ref
}

export function isRef(v: any): v is Ref {
  return v ? v[refSymbol] === true : false
}

export function toRefs<T extends object>(
  object: T
): { [K in keyof T]: Ref<T[K]> } {
  const ret: any = {}
  for (const key in object) {
    ret[key] = toProxyRef(object, key)
  }
  return ret
}

function toProxyRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): Ref<T[K]> {
  return {
    [refSymbol]: true,
    get value(): any {
      return object[key]
    },
    set value(newVal) {
      object[key] = newVal
    }
  }
}

type BailTypes =
  | Function
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>

// Recursively unwraps nested value bindings.
export type UnwrapRef<T> = {
  ref: T extends Ref<infer V> ? UnwrapRef<V> : T
  array: T extends Array<infer V> ? Array<UnwrapRef<V>> : T
  object: { [K in keyof T]: UnwrapRef<T[K]> }
  stop: T
}[T extends Ref
  ? 'ref'
  : T extends Array<any>
    ? 'array'
    : T extends BailTypes
      ? 'stop' // bail out on types that shouldn't be unwrapped
      : T extends object ? 'object' : 'stop']

// only unwrap nested ref
export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>
