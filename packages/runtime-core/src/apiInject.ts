import { value, isValue, Value } from './apiState'
import { currentInstance } from './component'

export interface Key<T> extends Symbol {}

export function provide<T>(key: Key<T>, value: T | Value<T>) {
  if (!currentInstance) {
    // TODO warn
  } else {
    const provides = currentInstance.provides || (currentInstance.provides = {})
    provides[key as any] = value
  }
}

export function inject<T>(key: Key<T>): Value<T> | undefined {
  // traverse parent chain and look for provided value
  if (!currentInstance) {
    // TODO warn
  } else {
    let parent = currentInstance.parent
    while (parent) {
      const { provides } = parent
      if (provides !== null && provides.hasOwnProperty(key as any)) {
        const val = provides[key as any]
        return isValue(val) ? val : value(val)
      }
      parent = parent.parent
    }
  }
}
