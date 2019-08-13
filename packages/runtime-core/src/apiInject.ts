import { value, isValue, Value } from './apiState'
import { currentInstance } from './component'

export interface Key<T> extends Symbol {}

export function provide<T>(key: Key<T> | string, value: T | Value<T>) {
  if (!currentInstance) {
    // TODO warn
  } else {
    let provides = currentInstance.provides
    // by default an instance inherits its parent's provides object
    // but when it needs to provide values of its own, it creates its
    // own provides object using parent provides object as prototype.
    // this way in `inject` we can simply look up injections from direct
    // parent and let the prototype chain do the work.
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    provides[key as any] = value
  }
}

export function inject<T>(key: Key<T> | string): Value<T> | undefined {
  if (!currentInstance) {
    // TODO warn
  } else {
    // TODO should also check for app-level provides
    const provides = currentInstance.parent && currentInstance.provides
    if (provides) {
      const val = provides[key as any] as any
      return isValue(val) ? val : value(val)
    }
  }
}
