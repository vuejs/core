import {
  activeEffect,
  getDepFromReactive,
  shouldTrack,
  trackEffects,
  triggerEffects
} from './effect'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { isArray, hasChanged, IfAny } from '@vue/shared'
import {
  isProxy,
  toRaw,
  isReactive,
  toReactive,
  isReadonly,
  isShallow
} from './reactive'
import type { ShallowReactiveMarker } from './reactive'
import { CollectionTypes } from './collectionHandlers'
import { createDep, Dep } from './dep'

declare const RefSymbol: unique symbol
export declare const RawSymbol: unique symbol

export interface Ref<T = any> {
  value: T
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  [RefSymbol]: true
}

type RefBase<T> = {
  dep?: Dep
  value: T
}

export function trackRefValue(ref: RefBase<any>) {
  if (shouldTrack && activeEffect) {
    ref = toRaw(ref)
    if (__DEV__) {
      trackEffects(ref.dep || (ref.dep = createDep()), {
        target: ref,
        type: TrackOpTypes.GET,
        key: 'value'
      })
    } else {
      trackEffects(ref.dep || (ref.dep = createDep()))
    }
  }
}

export function triggerRefValue(ref: RefBase<any>, newVal?: any) {
  ref = toRaw(ref)
  const dep = ref.dep
  if (dep) {
    if (__DEV__) {
      triggerEffects(dep, {
        target: ref,
        type: TriggerOpTypes.SET,
        key: 'value',
        newValue: newVal
      })
    } else {
      triggerEffects(dep)
    }
  }
}

/**
 * Checks if a value is a ref object.
 */
export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}

/**
 * Takes an object as inner value and returns a reactive and mutable ref object.
 *
 * The ref object has a single `value` property that points to the inner value.
 * The object is made deeply reactive by the `reactive` function.
 *
 * If the type of the generic is unknown, it's recommended to cast ref to
 * `Ref<T>`:
 *
 * ```ts
 * function useState<State extends string>(initial: State) {
 *   const state = ref(initial) as Ref<State> // state.value -> State extends string
 *   return state
 * }
 * ```
 */
export function ref<T extends object>(
  value: T
): [T] extends [Ref] ? T : Ref<UnwrapRef<T>>
/**
 * Takes an inner value and returns a reactive and mutable ref object.
 *
 * The ref object has a single `value` property that points to the inner value.
 *
 * ```js
 * const count = ref(0)
 * console.log(count.value) // 0
 * count.value++
 * console.log(count.value) // 1
 * ```
 *
 * Sometimes we may need to specify complex types for a ref's inner value. We
 * can do that succinctly by passing a generics argument when calling `ref` to
 * override the default inference:
 *
 * ```ts
 * const foo = ref<string | number>('foo') // foo's type: Ref<string | number>
 * foo.value = 123 // ok!
 * ```
 */
export function ref<T>(value: T): Ref<UnwrapRef<T>>
/**
 * Takes an inner value and returns a reactive and mutable ref object.
 *
 * The ref has a single `value` property that points to the inner value.
 */
export function ref<T = any>(): Ref<T | undefined>
export function ref(value?: unknown) {
  return createRef(value, false)
}

declare const ShallowRefMarker: unique symbol

export type ShallowRef<T = any> = Ref<T> & { [ShallowRefMarker]?: true }

/**
 * Creates a ref that tracks mutations on its own `value` but doesn't make its
 * value reactive.
 *
 * ```js
 * const foo = shallowRef({})
 * // mutating the ref's value is reactive
 * foo.value = {}
 * // but the value will not be converted.
 * isReactive(foo.value) // false
 * ```
 *
 * See also: https://v3.vuejs.org/guide/reactivity-fundamentals.html#creating-standalone-reactive-values-as-refs
 */
export function shallowRef<T extends object>(
  value: T
): T extends Ref ? T : ShallowRef<T>
/**
 * Creates a ref that tracks mutations on its own `value` but doesn't make its
 * value reactive.
 *
 * ```js
 * const foo = shallowRef({})
 * // mutating the ref's value is reactive
 * foo.value = {}
 * // but the value will not be converted.
 * isReactive(foo.value) // false
 * ```
 *
 * See also: https://v3.vuejs.org/guide/reactivity-fundamentals.html#creating-standalone-reactive-values-as-refs
 */
export function shallowRef<T>(value: T): ShallowRef<T>
/**
 * Creates a ref that tracks mutations on its own `value` but doesn't make its
 * value reactive.
 *
 * ```js
 * const foo = shallowRef({})
 * // mutating the ref's value is reactive
 * foo.value = {}
 * // but the value will not be converted.
 * isReactive(foo.value) // false
 * ```
 *
 * See also: https://v3.vuejs.org/guide/reactivity-fundamentals.html#creating-standalone-reactive-values-as-refs
 */
export function shallowRef<T = any>(): ShallowRef<T | undefined>
export function shallowRef(value?: unknown) {
  return createRef(value, true)
}

function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}

class RefImpl<T> {
  private _value: T
  private _rawValue: T

  public dep?: Dep = undefined
  public readonly __v_isRef = true

  constructor(value: T, public readonly __v_isShallow: boolean) {
    this._rawValue = __v_isShallow ? value : toRaw(value)
    this._value = __v_isShallow ? value : toReactive(value)
  }

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    const useDirectValue =
      this.__v_isShallow || isShallow(newVal) || isReadonly(newVal)
    newVal = useDirectValue ? newVal : toRaw(newVal)
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal
      this._value = useDirectValue ? newVal : toReactive(newVal)
      triggerRefValue(this, newVal)
    }
  }
}

/**
 * Execute any effects tied to a shallow ref manually.
 *
 * ```js
 * const shallow = shallowRef({
 *   greet: 'Hello, world'
 * })
 *
 * // Logs "Hello, world" once for the first run-through
 * watchEffect(() => {
 *   console.log(shallow.value.greet)
 * })
 *
 * // This won't trigger the effect because the ref is shallow
 * shallow.value.greet = 'Hello, universe'
 *
 * // Logs "Hello, universe"
 * triggerRef(shallow)
 * ```
 *
 * See also: https://v3.vuejs.org/api/computed-watch-api.html#watcheffect
 */
export function triggerRef(ref: Ref) {
  triggerRefValue(ref, __DEV__ ? ref.value : void 0)
}

/**
 * Returns the inner value if the argument is a ref, otherwise return the
 * argument itself.
 *
 * This is a sugar function for `val = isRef(val) ? val.value : val`.
 *
 * ```js
 * function useFoo(x: number | Ref<number>) {
 *   const unwrapped = unref(x) // unwrapped is guaranteed to be number now
 * }
 * ```
 */
export function unref<T>(ref: T | Ref<T>): T {
  return isRef(ref) ? (ref.value as any) : ref
}

const shallowUnwrapHandlers: ProxyHandler<any> = {
  get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key]
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value
      return true
    } else {
      return Reflect.set(target, key, value, receiver)
    }
  }
}

/**
 * todo: document? This is published in vue-core, as well!
 */
export function proxyRefs<T extends object>(
  objectWithRefs: T
): ShallowUnwrapRef<T> {
  return isReactive(objectWithRefs)
    ? objectWithRefs
    : new Proxy(objectWithRefs, shallowUnwrapHandlers)
}

export type CustomRefFactory<T> = (
  track: () => void,
  trigger: () => void
) => {
  get: () => T
  set: (value: T) => void
}

class CustomRefImpl<T> {
  public dep?: Dep = undefined

  private readonly _get: ReturnType<CustomRefFactory<T>>['get']
  private readonly _set: ReturnType<CustomRefFactory<T>>['set']

  public readonly __v_isRef = true

  constructor(factory: CustomRefFactory<T>) {
    const { get, set } = factory(
      () => trackRefValue(this),
      () => triggerRefValue(this)
    )
    this._get = get
    this._set = set
  }

  get value() {
    return this._get()
  }

  set value(newVal) {
    this._set(newVal)
  }
}

/**
 * Creates a customized ref with explicit control over its dependency tracking
 * and updates triggering.
 *
 * It expects a factory function, which receives `track` and `trigger` functions
 * as arguments and should return an object with `get` and `set`.
 *
 * Example using a custom ref to implement debounce with `v-model`:
 *
 * ```js
 * // in the template: <input v-model="text" />
 *
 * function useDebouncedRef(value, delay = 200) {
 *   let timeout
 *   return customRef((track, trigger) => {
 *     return {
 *       get() {
 *         track()
 *         return value
 *       },
 *       set(newValue) {
 *         clearTimeout(timeout)
 *         timeout = setTimeout(() => {
 *           value = newValue
 *           trigger()
 *         }, delay)
 *       }
 *     }
 *   })
 * }
 *
 * export default {
 *   setup() {
 *     return {
 *       text: useDebouncedRef('hello')
 *     }
 *   }
 * }
 * ```
 */
export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  return new CustomRefImpl(factory) as any
}

export type ToRefs<T = any> = {
  [K in keyof T]: ToRef<T[K]>
}

/**
 * Converts a reactive object to a plain object where each property of the
 * resulting object is a ref pointing to the corresponding property of the
 * original object.
 *
 * ```js
 * const state = reactive({
 *   foo: 1,
 *   bar: 2
 * })
 *
 * // type of stateAsRefs: { foo: Ref<number>, bar: Ref<number> }
 * const stateAsRefs = toRefs(state)
 *
 * // The ref and the original property is "linked"
 * state.foo++
 * console.log(stateAsRefs.foo.value) // 2
 *
 * stateAsRefs.foo.value++
 * console.log(state.foo) // 3
 * ```
 *
 * `toRefs` is useful when returning a reactive object from a composition
 * function so that the consuming component can destructure/spread the returned
 * object without losing reactivity:
 *
 * ```js
 * function useFeatureX() {
 *   const state = reactive({
 *     foo: 1,
 *     bar: 2
 *   })
 *
 *   // logic operating on state
 *
 *   // convert to refs when returning
 *   return toRefs(state)
 * }
 *
 * export default {
 *   setup() {
 *     // can destructure without losing reactivity
 *     const { foo, bar } = useFeatureX()
 *
 *     return {
 *       foo,
 *       bar
 *     }
 *   }
 * }
 * ```
 *
 * `toRefs` will only generate refs for properties that are included in the
 * source object. To create a ref for a specific property use `toRef` instead.
 */
export function toRefs<T extends object>(object: T): ToRefs<T> {
  if (__DEV__ && !isProxy(object)) {
    console.warn(`toRefs() expects a reactive object but received a plain one.`)
  }
  const ret: any = isArray(object) ? new Array(object.length) : {}
  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}

class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly __v_isRef = true

  constructor(
    private readonly _object: T,
    private readonly _key: K,
    private readonly _defaultValue?: T[K]
  ) {}

  get value() {
    const val = this._object[this._key]
    return val === undefined ? (this._defaultValue as T[K]) : val
  }

  set value(newVal) {
    this._object[this._key] = newVal
  }

  get dep(): Dep | undefined {
    return getDepFromReactive(toRaw(this._object), this._key)
  }
}

export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>

/**
 * Can be used to create a ref for a property on a source reactive object.
 *
 * The ref can then be passed around, retaining the reactive connection to its
 * source property.
 *
 * ```js
 * const state = reactive({
 *   foo: 1,
 *   bar: 2
 * })
 *
 * const fooRef = toRef(state, 'foo')
 *
 * fooRef.value++
 * console.log(state.foo) // 2
 *
 * state.foo++
 * console.log(fooRef.value) // 3
 * ```
 *
 * `toRef` is useful when you want to pass the ref of a prop to a composition
 * function:
 *
 * ```js
 * export default {
 *   setup(props) {
 *     useSomeFeature(toRef(props, 'foo'))
 *   }
 * }
 * ```
 *
 * `toRef` will return a usable ref even if the source property doesn't
 * currently exist. This makes it especially useful when working with optional
 * props, which wouldn't be picked up by `toRefs`.
 */
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): ToRef<T[K]>

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K]
): ToRef<Exclude<T[K], undefined>>

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue?: T[K]
): ToRef<T[K]> {
  const val = object[key]
  return isRef(val)
    ? val
    : (new ObjectRefImpl(object, key, defaultValue) as any)
}

// corner case when use narrows type
// Ex. type RelativePath = string & { __brand: unknown }
// RelativePath extends object -> true
type BaseTypes = string | number | boolean

/**
 * This is a special exported interface for other packages to declare
 * additional types that should bail out for ref unwrapping. For example
 * \@vue/runtime-dom can declare it like so in its d.ts:
 *
 * ``` ts
 * declare module '@vue/reactivity' {
 *   export interface RefUnwrapBailTypes {
 *     runtimeDOMBailTypes: Node | Window
 *   }
 * }
 * ```
 */
export interface RefUnwrapBailTypes {}

export type ShallowUnwrapRef<T> = {
  [K in keyof T]: T[K] extends Ref<infer V>
    ? V // if `V` is `unknown` that means it does not extend `Ref` and is undefined
    : T[K] extends Ref<infer V> | undefined
    ? unknown extends V
      ? undefined
      : V | undefined
    : T[K]
}

export type UnwrapRef<T> = T extends ShallowRef<infer V>
  ? V
  : T extends Ref<infer V>
  ? UnwrapRefSimple<V>
  : UnwrapRefSimple<T>

export type UnwrapRefSimple<T> = T extends
  | Function
  | CollectionTypes
  | BaseTypes
  | Ref
  | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
  | { [RawSymbol]?: true }
  ? T
  : T extends ReadonlyArray<any>
  ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
  : T extends object & { [ShallowReactiveMarker]?: never }
  ? {
      [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>
    }
  : T
