import { isObject, toRawType, def } from '@vue/shared'
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers
} from './baseHandlers'
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers,
  shallowReadonlyCollectionHandlers
} from './collectionHandlers'
import type { UnwrapRefSimple, Ref, RawSymbol } from './ref'

export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
}

export const reactiveMap = new WeakMap<Target, any>()
export const shallowReactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()
export const shallowReadonlyMap = new WeakMap<Target, any>()

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

// only unwrap nested ref
export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>

/**
 * Creates a reactive copy of the original object.
 *
 * The reactive conversion is "deep" — it affects all nested properties. In the
 * ES2015 Proxy based implementation, the returned proxy is **not** equal to the
 * original object. It is recommended to work exclusively with the reactive
 * proxy and avoid relying on the original object.
 *
 * **Note:** `reactive` will unwrap all the deep refs, while maintaining the ref
 * reactivity:
 *
 * ```js
 * const count = ref(1)
 * const obj = reactive({ count })
 *
 * // ref will be unwrapped
 * console.log(obj.count === count.value) // true
 *
 * // it will update `obj.count`
 * count.value++
 * console.log(count.value) // 2
 * console.log(obj.count) // 2
 *
 * // it will also update `count` ref
 * obj.count++
 * console.log(obj.count) // 3
 * console.log(count.value) // 3
 * ```
 *
 * **Important:** When assigning a ref to a reactive property, that ref will be
 * automatically unwrapped:
 *
 * ```js
 * const count = ref(1)
 * const obj = reactive({})
 *
 * obj.count = count
 *
 * console.log(obj.count) // 1
 * console.log(obj.count === count.value) // true
 * ```
 */
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  if (isReadonly(target)) {
    return target
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  )
}

export declare const ShallowReactiveMarker: unique symbol

export type ShallowReactive<T> = T & { [ShallowReactiveMarker]?: true }

/**
 * Returns a shallowly-reactive copy of the original object.
 *
 * This proxy will track reactivity of its own properties but does not perform
 * deep reactive conversion of nested objects (i.e. it exposes "raw" values).
 *
 * Unlike `reactive`, any property that uses a ref will **not** be automatically
 * unwrapped by the proxy (even at the root level).
 *
 * ```js
 * const state = shallowReactive({
 *   foo: 1,
 *   nested: {
 *     bar: 2
 *   }
 * })
 *
 * // mutating state's own properties is reactive
 * state.foo++
 * // ...but does not convert nested objects
 * isReactive(state.nested) // false
 * state.nested.bar++ // non-reactive
 * ```
 */
export function shallowReactive<T extends object>(
  target: T
): ShallowReactive<T> {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  )
}

type Primitive = string | number | boolean | bigint | symbol | undefined | null
type Builtin = Primitive | Function | Date | Error | RegExp
export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends ReadonlyMap<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends Set<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends ReadonlySet<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends WeakSet<infer U>
  ? WeakSet<DeepReadonly<U>>
  : T extends Promise<infer U>
  ? Promise<DeepReadonly<U>>
  : T extends Ref<infer U>
  ? Readonly<Ref<DeepReadonly<U>>>
  : T extends {}
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : Readonly<T>

/**
 * Creates a readonly copy of the original object.
 *
 * Takes an object (reactive or plain) or a ref and returns a readonly proxy to
 * the original. A readonly proxy is "deep": any nested property accessed will
 * be readonly as well.
 *
 * ```js
 * const original = reactive({ count: 0 })
 *
 * const copy = readonly(original)
 *
 * watchEffect(() => {
 *   // works for reactivity tracking
 *   console.log(copy.count)
 * })
 *
 * // mutating original will trigger watchers relying on the copy
 * original.count++
 *
 * // mutating the copy will fail and result in a warning
 * copy.count++ // warning!
 * ```
 *
 * As with `reactive`, if any property uses a ref it will be automatically
 * unwrapped when it is accessed via the proxy:
 *
 * ```js
 * const raw = {
 *  count: ref(123)
 *}
 *
 * const copy = readonly(raw)
 *
 * console.log(raw.count.value) // 123
 * console.log(copy.count) // 123
 * ```
 *
 * Note: The returned copy is not made reactive, but `readonly` can be called on
 * an already reactive object.
 */
export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  )
}

/**
 * Returns a shallowly-reactive copy of the original object.
 *
 * Creates a proxy that makes its own properties readonly, but does not perform
 * deep readonly conversion of nested objects (exposes raw values).
 *
 * ```js
 * const state = shallowReadonly({
 *   foo: 1,
 *   nested: {
 *     bar: 2
 *   }
 * })
 *
 * // mutating state's own properties will fail
 * state.foo++
 * // ...but works on nested objects
 * isReadonly(state.nested) // false
 * state.nested.bar++ // works
 * ```
 *
 * Unlike `readonly`, any property that uses a ref will **not** be automatically
 * unwrapped by the proxy.
 *
 * This is used for creating the props proxy object for stateful components.
 */
export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  )
}

function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }
  // target already has corresponding Proxy
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  // only specific value types can be observed.
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )
  proxyMap.set(target, proxy)
  return proxy
}

/**
 * Checks if an object is a reactive proxy created by `reactive`.
 *
 * ```js
 * import { reactive, isReactive } from 'vue'
 * export default {
 *   setup() {
 *     const state = reactive({
 *       name: 'John'
 *     })
 *     console.log(isReactive(state)) // -> true
 *   }
 * }
 * ```
 *
 * It also returns `true` if the proxy is created by `readonly`, but is
 * wrapping another proxy created by `reactive`.
 *
 * ```js
 * import { reactive, isReactive, readonly } from 'vue'
 * export default {
 *   setup() {
 *     const state = reactive({
 *       name: 'John'
 *     })
 *     // readonly proxy created from plain object
 *     const plain = readonly({
 *       name: 'Mary'
 *     })
 *     console.log(isReactive(plain)) // -> false
 *
 *     // readonly proxy created from reactive proxy
 *     const stateCopy = readonly(state)
 *     console.log(isReactive(stateCopy)) // -> true
 *   }
 * }
 * ```
 */
export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

/**
 * Checks if an object is a readonly proxy created by `readonly`.
 */
export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}

export function isShallow(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_SHALLOW])
}

/**
 * Checks if an object is a proxy created by `reactive` or `readonly`.
 */
export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

/**
 * Returns the raw, original object of a reactive or readonly proxy.
 *
 * This is an escape hatch that can be used to temporarily read without
 * incurring proxy access/tracking overhead or write without triggering changes.
 * It is **not** recommended to hold a persistent reference to the original
 * object. Use with caution.
 *
 * ```js
 * const foo = {}
 * const reactiveFoo = reactive(foo)
 *
 * console.log(toRaw(reactiveFoo) === foo) // true
 * ```
 */
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}

export type Raw<T> = T & { [RawSymbol]?: true }

/**
 * Marks an object so that it will never be converted to a proxy.
 *
 * Returns the object itself.
 *
 * ```js
 * const foo = markRaw({})
 * console.log(isReactive(reactive(foo))) // false
 *
 * // also works when nested inside other reactive objects
 * const bar = reactive({ foo })
 * console.log(isReactive(bar.foo)) // false
 * ```
 *
 * **Warning:** `markRaw` and the `shallowXXX` APIs below allow you to
 * selectively opt-out of the default deep reactive/readonly conversion and
 * embed raw, non-proxied objects in your state graph. They can be used for
 * various reasons:
 *
 * * Some values simply should not be made reactive, for example a complex 3rd
 *   party class instance, or a Vue component object.
 * * Skipping proxy conversion can provide performance improvements when
 *   rendering large lists with immutable data sources.
 *
 * They are considered advanced because the raw opt-out is only at the root
 * level, so if you set a nested, non-marked raw object into a reactive object
 * and then access it again, you get the proxied version back. This can lead to
 * **identity hazards** - i.e. performing an operation that relies on object
 * identity but using both the raw and the proxied version of the same object:
 *
 * ```js
 * const foo = markRaw({
 *   nested: {}
 * })
 *
 * const bar = reactive({
 *   // although `foo` is marked as raw, foo.nested is not.
 *   nested: foo.nested
 * })
 *
 * console.log(foo.nested === bar.nested) // false
 * ```
 *
 * Identity hazards are in general rare. However, to properly utilize these APIs
 * while safely avoiding identity hazards requires a solid understanding of how
 * the reactivity system works.
 */
export function markRaw<T extends object>(value: T): Raw<T> {
  def(value, ReactiveFlags.SKIP, true)
  return value
}

/**
 * Returns a reactive proxy of the given value (if possible).
 *
 * If the given value is not an object, the original value itself is returned.
 */
export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value

/**
 * Returns a readonly proxy of the given value (if possible).
 *
 * If the given value is not an object, the original value itself is returned.
 */
export const toReadonly = <T extends unknown>(value: T): T =>
  isObject(value) ? readonly(value as Record<any, any>) : value
