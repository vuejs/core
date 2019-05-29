import { track, trigger } from './effect'
import { OperationTypes } from './operations'

const knownValues = new WeakSet()

export interface Value<T> {
  value: T
}

export function value<T>(raw: T): Value<T> {
  const v = {
    get value() {
      track(v, OperationTypes.GET, '')
      return raw
    },
    set value(newVal) {
      raw = newVal
      trigger(v, OperationTypes.SET, '')
    }
  }
  knownValues.add(v)
  return v
}

export function isValue(v: any): boolean {
  return knownValues.has(v)
}
