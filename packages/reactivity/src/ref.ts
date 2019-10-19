import { track, trigger } from './effect'
import { OperationTypes } from './operations'
import { isObject } from '@vue/shared'
import { reactive } from './reactive'
import { ComputedRef } from './computed'

export interface Ref<T = any> {
  _isRef: true
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
    _isRef: true,
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
  return v ? v._isRef === true : false
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
    _isRef: true,
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
  cRef: T extends ComputedRef<infer V> ? UnwrapRef<V> : T
  ref: T extends Ref<infer V> ? UnwrapRef<V> : T
  array: T extends Array<infer V> ? Array<UnwrapRef<V>> : T
  object: { [K in keyof T]: UnwrapRef<T[K]> }
}[T extends ComputedRef<any>
  ? 'cRef'
  : T extends Ref
    ? 'ref'
    : T extends Array<any>
      ? 'array'
      : T extends BailTypes
        ? 'ref' // bail out on types that shouldn't be unwrapped
        : T extends object ? 'object' : 'ref']
