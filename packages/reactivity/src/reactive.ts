import { isObject } from '@vue/shared'
import { mutableHandlers, immutableHandlers } from './baseHandlers'

import {
  mutableCollectionHandlers,
  immutableCollectionHandlers
} from './collectionHandlers'

import { UnwrapRef } from './ref'
import { ReactiveEffect } from './effect'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
export type Dep = Set<ReactiveEffect>
export type KeyToDepMap = Map<string | symbol, Dep>
export const targetMap: WeakMap<any, KeyToDepMap> = new WeakMap()

// WeakMaps that store {raw <-> observed} pairs.
const rawToObserved: WeakMap<any, any> = new WeakMap()
const observedToRaw: WeakMap<any, any> = new WeakMap()
const rawToImmutable: WeakMap<any, any> = new WeakMap()
const immutableToRaw: WeakMap<any, any> = new WeakMap()

// WeakSets for values that are marked immutable or non-reactive during
// observable creation.
const immutableValues: WeakSet<any> = new WeakSet()
const nonReactiveValues: WeakSet<any> = new WeakSet()

const collectionTypes: Set<any> = new Set([Set, Map, WeakMap, WeakSet])
const observableValueRE = /^\[object (?:Object|Array|Map|Set|WeakMap|WeakSet)\]$/

const canObserve = (value: any): boolean => {
  return (
    !value._isVue &&
    !value._isVNode &&
    observableValueRE.test(Object.prototype.toString.call(value)) &&
    !nonReactiveValues.has(value)
  )
}

type ObservableFactory = <T>(target?: T) => UnwrapRef<T>

export const reactive = ((target: unknown): any => {
  // if trying to observe an immutable proxy, return the immutable version.
  if (immutableToRaw.has(target)) {
    return target
  }
  // target is explicitly marked as immutable by user
  if (immutableValues.has(target)) {
    return immutable(target)
  }
  return createReactiveObject(
    target,
    rawToObserved,
    observedToRaw,
    mutableHandlers,
    mutableCollectionHandlers
  )
}) as ObservableFactory

export const immutable = ((target: unknown): any => {
  // value is a mutable observable, retrive its original and return
  // a readonly version.
  if (observedToRaw.has(target)) {
    target = observedToRaw.get(target)
  }
  return createReactiveObject(
    target,
    rawToImmutable,
    immutableToRaw,
    immutableHandlers,
    immutableCollectionHandlers
  )
}) as ObservableFactory

function createReactiveObject(
  target: any,
  toProxy: WeakMap<any, any>,
  toRaw: WeakMap<any, any>,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>
) {
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
  // target already has corresponding Proxy
  let observed = toProxy.get(target)
  if (observed !== void 0) {
    return observed
  }
  // target is already a Proxy
  if (toRaw.has(target)) {
    return target
  }
  // only a whitelist of value types can be observed.
  if (!canObserve(target)) {
    return target
  }
  const handlers = collectionTypes.has(target.constructor)
    ? collectionHandlers
    : baseHandlers
  observed = new Proxy(target, handlers)
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  if (!targetMap.has(target)) {
    targetMap.set(target, new Map())
  }
  return observed
}

export function isReactive(value: any): boolean {
  return observedToRaw.has(value) || immutableToRaw.has(value)
}

export function isImmutable(value: any): boolean {
  return immutableToRaw.has(value)
}

export function toRaw<T>(observed: T): T {
  return observedToRaw.get(observed) || immutableToRaw.get(observed) || observed
}

export function markImmutable<T>(value: T): T {
  immutableValues.add(value)
  return value
}

export function markNonReactive<T>(value: T): T {
  nonReactiveValues.add(value)
  return value
}
