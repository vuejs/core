import { ref, isRef, Ref } from './apiState'
import { currentInstance } from './component'

export interface InjectionKey<T> extends Symbol {}

export function provide<T>(key: InjectionKey<T> | string, value: T | Ref<T>) {
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

export function inject<T>(key: InjectionKey<T> | string): Ref<T> | undefined
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T
): Ref<T>
export function inject(key: InjectionKey<any> | string, defaultValue?: any) {
  if (!currentInstance) {
    // TODO warn
  } else {
    // TODO should also check for app-level provides
    const provides = currentInstance.parent && currentInstance.provides
    const val =
      provides && key in provides ? (provides[key as any] as any) : defaultValue
    return isRef(val) ? val : ref(val)
  }
}
