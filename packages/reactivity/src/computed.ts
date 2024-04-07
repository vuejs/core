import { type DebuggerOptions, ReactiveEffect } from './effect'
import { type Ref, trackRefValue, triggerRefValue } from './ref'
import { NOOP, hasChanged, isFunction } from '@vue/shared'
import { toRaw } from './reactive'
import type { Dep } from './dep'
import { DirtyLevels, ReactiveFlags } from './constants'
import { warn } from './warning'

declare const ComputedRefSymbol: unique symbol

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
  [ComputedRefSymbol]: true
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>
}

export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export const COMPUTED_SIDE_EFFECT_WARN =
  `Computed is still dirty after getter evaluation,` +
  ` likely because a computed is mutating its own dependency in its getter.` +
  ` State mutations in computed getters should be avoided. ` +
  ` Check the docs for more details: https://vuejs.org/guide/essentials/computed.html#getters-should-be-side-effect-free`

/**
 * 实现一个计算属性的引用类
 *
 * @template T 计算属性的值的类型
 */
export class ComputedRefImpl<T> {
  // 可能存在的依赖项管理对象
  public dep?: Dep = undefined

  // 计算属性的当前值，使用强制解包避免类型错误
  private _value!: T
  // 与计算属性关联的响应式效果
  public readonly effect: ReactiveEffect<T>

  // 标记这是一个引用类型
  public readonly __v_isRef = true
  // 标记是否为只读引用，这里默认为false
  public readonly [ReactiveFlags.IS_READONLY]: boolean = false

  // 控制是否缓存计算结果
  public _cacheable: boolean

  /**
   * Dev only
   * 仅开发环境使用，用于警告递归调用的问题
   */
  _warnRecursive?: boolean

  /**
   * 构造函数
   *
   * @param getter 计算属性的获取函数
   * @param _setter 计算属性的设置函数
   * @param isReadonly 是否为只读计算属性
   * @param isSSR 是否在服务器端渲染环境下
   */
  constructor(
    private getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean,
    isSSR: boolean,
  ) {
    // 初始化响应式效果
    this.effect = new ReactiveEffect(
      () => getter(this._value),
      () =>
        triggerRefValue(
          this,
          this.effect._dirtyLevel === DirtyLevels.MaybeDirty_ComputedSideEffect
            ? DirtyLevels.MaybeDirty_ComputedSideEffect
            : DirtyLevels.MaybeDirty,
        ),
    )
    // 设置effect的相关属性
    this.effect.computed = this
    this.effect.active = this._cacheable = !isSSR
    // 标记是否为只读
    this[ReactiveFlags.IS_READONLY] = isReadonly
  }

  /**
   * 获取计算属性的当前值
   *
   * 包含缓存逻辑和脏检查逻辑。
   */
  get value() {
    // 确保在原始对象上操作以避免代理的影响
    // the computed ref may get wrapped by other proxies e.g. readonly() #3376
    const self = toRaw(this)
    // 如果不允许缓存或属性已脏，则重新计算值
    if (
      (!self._cacheable || self.effect.dirty) &&
      hasChanged(self._value, (self._value = self.effect.run()!))
    ) {
      triggerRefValue(self, DirtyLevels.Dirty)
    }
    // 跟踪计算属性的访问
    trackRefValue(self)
    // 如果存在副作用，进行额外的处理
    if (self.effect._dirtyLevel >= DirtyLevels.MaybeDirty_ComputedSideEffect) {
      if (__DEV__ && (__TEST__ || this._warnRecursive)) {
        warn(COMPUTED_SIDE_EFFECT_WARN, `\n\ngetter: `, this.getter)
      }
      triggerRefValue(self, DirtyLevels.MaybeDirty_ComputedSideEffect)
    }
    return self._value
  }

  set value(newValue: T) {
    this._setter(newValue)
  }

  // #region polyfill _dirty for backward compatibility third party code for Vue <= 3.3.x
  get _dirty() {
    return this.effect.dirty
  }

  set _dirty(v) {
    this.effect.dirty = v
  }
  // #endregion
}

/**
 * Takes a getter function and returns a readonly reactive ref object for the
 * returned value from the getter. It can also take an object with get and set
 * functions to create a writable ref object.
 *
 * @example
 * ```js
 * // Creating a readonly computed ref:
 * const count = ref(1)
 * const plusOne = computed(() => count.value + 1)
 *
 * console.log(plusOne.value) // 2
 * plusOne.value++ // error
 * ```
 *
 * ```js
 * // Creating a writable computed ref:
 * const count = ref(1)
 * const plusOne = computed({
 *   get: () => count.value + 1,
 *   set: (val) => {
 *     count.value = val - 1
 *   }
 * })
 *
 * plusOne.value = 1
 * console.log(count.value) // 0
 * ```
 *
 * @param getter - Function that produces the next value.
 * @param debugOptions - For debugging. See {@link https://vuejs.org/guide/extras/reactivity-in-depth.html#computed-debugging}.
 * @see {@link https://vuejs.org/api/reactivity-core.html#computed}
 */
export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions,
): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
): WritableComputedRef<T>

/**
 * 创建一个计算属性，可以是只读的，也可以是可写的。
 *
 * @param getterOrOptions - 可以是一个计算属性的getter函数，或者是一个包含getter和setter的对象。
 * @param debugOptions - 可选的调试选项，仅在开发环境且不是SSR时使用，包括onTrack和onTrigger回调。
 * @param isSSR - 标记是否为服务器端渲染环境，默认为false。
 * @returns 返回一个ComputedRef实例，它封装了计算属性的getter和setter，以及相关的副作用管理。
 */
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false,
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>

  // 判断getterOrOptions是只包含getter的函数，还是包含getter和setter的对象
  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    // 如果是只读计算属性，设置getter为传入的函数，setter为一个警告函数（开发环境）或空操作（生产环境）
    getter = getterOrOptions
    setter = __DEV__
      ? () => {
          warn('Write operation failed: computed value is readonly')
        }
      : NOOP
  } else {
    // 如果是可写计算属性，从对象中提取getter和setter
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  // 创建ComputedRefImpl实例，根据是否只读或是否存在setter来配置
  const cRef = new ComputedRefImpl(getter, setter, onlyGetter || !setter, isSSR)

  // 如果处于开发环境，且提供了debugOptions，并且不是在SSR环境中，则应用调试选项
  if (__DEV__ && debugOptions && !isSSR) {
    cRef.effect.onTrack = debugOptions.onTrack
    cRef.effect.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}
