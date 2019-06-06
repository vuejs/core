import { isObject, EMPTY_OBJ } from '@vue/shared'
import { mutableHandlers, immutableHandlers } from './baseHandlers'

import {
  mutableCollectionHandlers,
  immutableCollectionHandlers
} from './collectionHandlers'

import {
  targetMap,
  observedToRaw,
  rawToObserved,
  immutableToRaw,
  rawToImmutable,
  immutableValues,
  nonReactiveValues
} from './state'

import {
  createReactiveEffect,
  cleanup,
  ReactiveEffect,
  ReactiveEffectOptions,
  DebuggerEvent
} from './effect'

import { UnwrapValue } from './value'

export { ReactiveEffect, ReactiveEffectOptions, DebuggerEvent }
export { OperationTypes } from './operations'
export { computed, ComputedValue } from './computed'
export { lock, unlock } from './lock'
export { value, isValue, Value, UnwrapValue } from './value'

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

type ObservableFactory = <T>(target?: T) => UnwrapValue<T>

export const observable = ((target: any = {}): any => {
  // if trying to observe an immutable proxy, return the immutable version.
  if (immutableToRaw.has(target)) {
    return target
  }
  // target is explicitly marked as immutable by user
  if (immutableValues.has(target)) {
    return immutable(target)
  }
  return createObservable(
    target,
    rawToObserved,
    observedToRaw,
    mutableHandlers,
    mutableCollectionHandlers
  )
}) as ObservableFactory

export const immutable = ((target: any = {}): any => {
  // value is a mutable observable, retrive its original and return
  // a readonly version.
  if (observedToRaw.has(target)) {
    target = observedToRaw.get(target)
  }
  return createObservable(
    target,
    rawToImmutable,
    immutableToRaw,
    immutableHandlers,
    immutableCollectionHandlers
  )
}) as ObservableFactory

function createObservable(
  target: any,
  toProxy: WeakMap<any, any>,
  toRaw: WeakMap<any, any>,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>
) {
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value is not observable: ${String(target)}`)
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

export function effect(
  fn: Function,
  options: ReactiveEffectOptions = EMPTY_OBJ
): ReactiveEffect {
  if ((fn as ReactiveEffect).isEffect) {
    fn = (fn as ReactiveEffect).raw
  }
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    effect()
  }
  return effect
}

export function stop(effect: ReactiveEffect) {
  if (effect.active) {
    cleanup(effect)
    if (effect.onStop) {
      effect.onStop()
    }
    effect.active = false
  }
}

export function isObservable(value: any): boolean {
  return observedToRaw.has(value) || immutableToRaw.has(value)
}

export function isImmutable(value: any): boolean {
  return immutableToRaw.has(value)
}

export function unwrap<T>(observed: T): T {
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
