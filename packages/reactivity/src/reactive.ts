import { isObject, toRawType } from '@vue/shared'
import {
  mutableHandlers,
  readonlyHandlers,
  readonlyPropsHandlers
} from './baseHandlers'
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers
} from './collectionHandlers'
import { ReactiveEffect } from './effect'
import { UnwrapRef, Ref } from './ref'
import { makeMap } from '@vue/shared'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
export type Dep = Set<ReactiveEffect>
export type KeyToDepMap = Map<any, Dep>
export const targetMap = new WeakMap<any, KeyToDepMap>()

// WeakMaps that store {raw <-> observed} pairs.
const rawToReactive = new WeakMap<any, any>() // 原始数据 转换为 响应式 map
const reactiveToRaw = new WeakMap<any, any>() // 响应式数据 转换为 原始数据 map
const rawToReadonly = new WeakMap<any, any>() // 原始数据 转换为 只读 map
const readonlyToRaw = new WeakMap<any, any>() // 只读数据 转换为 原始数据 map

// WeakSets for values that are marked readonly or non-reactive during
// observable creation.
const readonlyValues = new WeakSet<any>()
const nonReactiveValues = new WeakSet<any>()

const collectionTypes = new Set<Function>([Set, Map, WeakMap, WeakSet])
const isObservableType = /*#__PURE__*/ makeMap(
  'Object,Array,Map,Set,WeakMap,WeakSet'
)

const canObserve = (value: any): boolean => {
  return (
    !value._isVue &&
    !value._isVNode &&
    isObservableType(toRawType(value)) &&
    !nonReactiveValues.has(value)
  )
}

// only unwrap nested ref
type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>

export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  // 已经在只读map里，说明已经是响应式数据，直接 return
  if (readonlyToRaw.has(target)) {
    return target
  }
  // target is explicitly marked as readonly by user
  // 被用户标记为只读类型，调用只读方法
  if (readonlyValues.has(target)) {
    return readonly(target)
  }
  // 调用 创建响应式对象方法
  return createReactiveObject(
    target, // 目标对象
    rawToReactive, // 原始数据 map
    reactiveToRaw, // 响应式数据 map
    mutableHandlers,
    mutableCollectionHandlers
  )
}

export function readonly<T extends object>(
  target: T
): Readonly<UnwrapNestedRefs<T>> {
  // value is a mutable observable, retrieve its original and return
  // a readonly version.
  // 如果响应式 map 里有目标对象，从 map 里取出
  if (reactiveToRaw.has(target)) {
    target = reactiveToRaw.get(target)
  }
  return createReactiveObject(
    target,
    rawToReadonly,
    readonlyToRaw,
    readonlyHandlers,
    readonlyCollectionHandlers
  )
}

// @internal
// Return a readonly-copy of a props object, without unwrapping refs at the root
// level. This is intended to allow explicitly passing refs as props.
// Technically this should use different global cache from readonly(), but
// since it is only used on internal objects so it's not really necessary.
export function readonlyProps<T extends object>(
  target: T
): Readonly<{ [K in keyof T]: UnwrapNestedRefs<T[K]> }> {
  return createReactiveObject(
    target,
    rawToReadonly,
    readonlyToRaw,
    readonlyPropsHandlers,
    readonlyCollectionHandlers
  )
}

function createReactiveObject(
  target: unknown,
  toProxy: WeakMap<any, any>,
  toRaw: WeakMap<any, any>,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>
) {
  // 判断 target 是否是对象
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
  // target already has corresponding Proxy
  // 原始数据 已经有 对应的 响应式数据
  // 直接返回 对应的 响应式数据
  let observed = toProxy.get(target)
  if (observed !== void 0) {
    return observed
  }
  // target is already a Proxy
  // 原始数据 已经在 toRaw 里，说明已经是响应式数据
  // 直接返回 target
  if (toRaw.has(target)) {
    return target
  }
  // only a whitelist of value types can be observed.
  // 目标数据不能被 监听
  if (!canObserve(target)) {
    return target
  }
  // 根据数据是否是集合找寻对应的 handlers
  const handlers = collectionTypes.has(target.constructor)
    ? collectionHandlers
    : baseHandlers

  // 使用 new Proxy 监听，返回一个响应式对象
  observed = new Proxy(target, handlers)
  // 设置原始数据与响应式数据的双向映射
  toProxy.set(target, observed)
  toRaw.set(observed, target) 
  // 如果 targetMap 里没有原始数据，那么 set 进 targetMap 里
  if (!targetMap.has(target)) {
    targetMap.set(target, new Map())
  }
  return observed
}

export function isReactive(value: unknown): boolean {
  return reactiveToRaw.has(value) || readonlyToRaw.has(value)
}

export function isReadonly(value: unknown): boolean {
  return readonlyToRaw.has(value)
}

export function toRaw<T>(observed: T): T {
  return reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed
}

export function markReadonly<T>(value: T): T {
  readonlyValues.add(value)
  return value
}

export function markNonReactive<T>(value: T): T {
  nonReactiveValues.add(value)
  return value
}
