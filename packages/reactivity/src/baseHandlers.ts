import {
  type Target,
  isReadonly,
  isShallow,
  reactive,
  reactiveMap,
  readonly,
  readonlyMap,
  shallowReactiveMap,
  shallowReadonlyMap,
  toRaw,
} from './reactive'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import {
  pauseScheduling,
  pauseTracking,
  resetScheduling,
  resetTracking,
} from './effect'
import { ITERATE_KEY, track, trigger } from './reactiveEffect'
import {
  hasChanged,
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
  isSymbol,
  makeMap,
} from '@vue/shared'
import { isRef } from './ref'
import { warn } from './warning'

const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
  /*#__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => (Symbol as any)[key])
    .filter(isSymbol),
)

/**
 * 创建并返回一个包含数组操作Instrumentations的对象。
 * 这些Instrumentations用于对可能包含响应式值的数组方法进行拦截和处理，
 * 以实现对这些方法的追踪和优化。
 *
 * @returns {Record<string, Function>} 一个包含各种数组方法拦截器的对象。
 */
const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations()

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {}
  // instrument identity-sensitive Array methods to account for possible reactive
  // values
  // 为身份敏感的数组方法（如includes、indexOf、lastIndexOf）添加拦截器，以处理可能的响应式值。
  ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this) as any
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + '')
      }
      // 首先使用原始参数运行方法（可能包含响应式值）。
      // we run the method using the original args first (which may be reactive)
      const res = arr[key](...args)
      // 如果没有找到匹配项或方法返回false，使用原始值再次运行方法。
      if (res === -1 || res === false) {
        // if that didn't work, run it again using raw values.
        return arr[key](...args.map(toRaw))
      } else {
        return res
      }
    }
  })
  // 为改变数组长度的突变方法（如push、pop、shift、unshift、splice）添加拦截器，以避免长度被追踪而导致的潜在无限循环问题。
  // instrument length-altering mutation methods to avoid length being tracked
  // which leads to infinite loops in some cases (#2137)
  ;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      pauseTracking()
      pauseScheduling()
      // 暂停追踪和调度，然后使用原始值应用突变方法。
      const res = (toRaw(this) as any)[key].apply(this, args)
      resetScheduling()
      resetTracking()
      // 恢复追踪和调度，然后返回结果。
      return res
    }
  })
  return instrumentations
}

function hasOwnProperty(this: object, key: string) {
  const obj = toRaw(this)
  track(obj, TrackOpTypes.HAS, key)
  return obj.hasOwnProperty(key)
}

/**
 * 基础响应式处理器类，实现了 ProxyHandler 接口。
 * 用于处理对象的获取操作，并根据对象是否只读、是否浅响应式来决定具体的行为。
 *
 * @param _isReadonly 表示处理器处理的对象是否为只读模式，默认为 false。
 * @param _isShallow 表示处理器处理的对象是否为浅响应式，默认为 false。
 */
class BaseReactiveHandler implements ProxyHandler<Target> {
  constructor(
    protected readonly _isReadonly = false,
    protected readonly _isShallow = false,
  ) {}

  /**
   * 处理对象的获取操作。
   *
   * @param target 被代理的目标对象。
   * @param key 访问的属性键，可以是字符串或符号。
   * @param receiver 接收者对象，在处理属性访问时用到。
   * @returns 返回获取的属性值，具体返回值取决于处理逻辑。
   */
  get(target: Target, key: string | symbol, receiver: object) {
    const isReadonly = this._isReadonly,
      isShallow = this._isShallow
    // 特殊标志位处理，判断是否为只读、浅响应式等。
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return isShallow
    } else if (key === ReactiveFlags.RAW) {
      // 判断是否为原始对象的访问。
      if (
        receiver ===
          (isReadonly
            ? isShallow
              ? shallowReadonlyMap
              : readonlyMap
            : isShallow
              ? shallowReactiveMap
              : reactiveMap
          ).get(target) ||
        // receiver is not the reactive proxy, but has the same prototype
        // this means the receiver is a user proxy of the reactive proxy
        // 接收者不是响应式代理，但具有相同的原型，意味着接收者是响应式代理的用户代理。
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
      ) {
        return target
      }
      // early return undefined
      return
    }

    const targetIsArray = isArray(target)

    // 非只读模式下的特定处理。
    if (!isReadonly) {
      // 数组且具有特殊Instrumentations的属性访问处理。
      if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }
      // 'hasOwnProperty的特殊处理。
      if (key === 'hasOwnProperty') {
        return hasOwnProperty
      }
    }

    // 普通属性访问处理。
    const res = Reflect.get(target, key, receiver)

    // 对于Symbol类型键或非追踪键的特殊处理，直接返回结果。
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    // 非只读模式下的追踪处理。
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }
    // 浅响应式下的处理，直接返回结果。
    if (isShallow) {
      return res
    }
    // 对返回结果是 Ref 的特殊处理，避免在数组和整数键的情况下自动解包。
    if (isRef(res)) {
      // ref unwrapping - skip unwrap for Array + integer key.
      return targetIsArray && isIntegerKey(key) ? res : res.value
    }

    // 对返回结果是对象的处理，根据是否只读将其转为只读或响应式对象。
    if (isObject(res)) {
      // Convert returned value into a proxy as well. we do the isObject check
      // here to avoid invalid value warning. Also need to lazy access readonly
      // and reactive here to avoid circular dependency.
      return isReadonly ? readonly(res) : reactive(res)
    }

    // 返回最终处理后的结果。
    return res
  }
}

/**
 * 可变响应式处理器类，继承于BaseReactiveHandler。
 * 提供设置、删除属性和检查属性存在性等操作的处理逻辑。
 */
class MutableReactiveHandler extends BaseReactiveHandler {
  /**
   * 构造函数
   * @param isShallow 是否为浅响应式，默认为false
   */
  constructor(isShallow = false) {
    super(false, isShallow)
  }

  /**
   * 设置对象属性值。
   * @param target 目标对象
   * @param key 属性名或符号
   * @param value 新的属性值
   * @param receiver 接收者对象，通常为target本身
   * @returns 操作是否成功的布尔值
   */
  set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object,
  ): boolean {
    // 判断是否为浅响应式，进行相应处理
    let oldValue = (target as any)[key]
    if (!this._isShallow) {
      // 对旧值和新值进行判断和转换，确保操作的正确性
      const isOldValueReadonly = isReadonly(oldValue)
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue)
        value = toRaw(value)
      }
      // 对特定情况下的引用类型值进行特殊处理
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        if (isOldValueReadonly) {
          return false
        } else {
          oldValue.value = value
          return true
        }
      }
    } else {
      // in shallow mode, objects are set as-is regardless of reactive or not
    }

    // 触发相应的响应式操作
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)
    const result = Reflect.set(target, key, value, receiver)
    // don't trigger if target is something up in the prototype chain of original
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }

  /**
   * 删除对象属性。
   * @param target 目标对象
   * @param key 属性名或符号
   * @returns 操作是否成功的布尔值
   */
  deleteProperty(target: object, key: string | symbol): boolean {
    // 判断是否曾存在该属性，存在则触发相应响应式操作
    const hadKey = hasOwn(target, key)
    const oldValue = (target as any)[key]
    const result = Reflect.deleteProperty(target, key)
    if (result && hadKey) {
      trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
    }
    return result
  }

  /**
   * 检查对象是否包含属性。
   * @param target 目标对象
   * @param key 属性名或符号
   * @returns 对象是否包含该属性的布尔值
   */
  has(target: object, key: string | symbol): boolean {
    // 进行存在性追踪
    const result = Reflect.has(target, key)
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, TrackOpTypes.HAS, key)
    }
    return result
  }
  /**
   * 获取对象自身的所有键。
   * @param target 目标对象
   * @returns 对象自身的所有键的数组
   */
  ownKeys(target: object): (string | symbol)[] {
    // 在迭代时进行追踪
    track(
      target,
      TrackOpTypes.ITERATE,
      isArray(target) ? 'length' : ITERATE_KEY,
    )
    return Reflect.ownKeys(target)
  }
}

/**
 * 只读响应式处理器类，继承于BaseReactiveHandler。
 * 对设置和删除操作进行拦截，防止修改只读对象。
 */
class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow = false) {
    super(true, isShallow)
  }

  /**
   * 设置对象属性值（被拦截，防止修改）。
   * @param target 目标对象
   * @param key 属性名或符号
   * @returns 总是返回true，但实际不执行设置操作
   */
  set(target: object, key: string | symbol) {
    if (__DEV__) {
      warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target,
      )
    }
    return true
  }

  /**
   * 删除对象属性（被拦截，防止删除）。
   * @param target 目标对象
   * @param key 属性名或符号
   * @returns 总是返回true，但实际不执行删除操作
   */
  deleteProperty(target: object, key: string | symbol) {
    // 开发环境下的警告信息
    if (__DEV__) {
      warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target,
      )
    }
    return true
  }
}

// 导出相应的处理器实例，用于创建响应式对象
export const mutableHandlers: ProxyHandler<object> =
  /*#__PURE__*/ new MutableReactiveHandler()

export const readonlyHandlers: ProxyHandler<object> =
  /*#__PURE__*/ new ReadonlyReactiveHandler()

export const shallowReactiveHandlers = /*#__PURE__*/ new MutableReactiveHandler(
  true,
)

// 浅只读处理器，特殊处理保持只读性和引用的不变性
// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers =
  /*#__PURE__*/ new ReadonlyReactiveHandler(true)
