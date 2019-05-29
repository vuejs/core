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

export function isValue(v: any): boolean {
  return knownValues.has(v)
}
