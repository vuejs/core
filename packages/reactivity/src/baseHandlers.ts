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
import { arrayInstrumentations } from './arrayInstrumentations'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import { ITERATE_KEY, track, trigger } from './dep'
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

const isNonTrackableKeys = /*@__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
  /*@__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => Symbol[key as keyof SymbolConstructor])
    .filter(isSymbol),
)

function hasOwnProperty(this: object, key: unknown) {
  // #10455 hasOwnProperty may be called with non-string values
  if (!isSymbol(key)) key = String(key)
  const obj = toRaw(this)
  track(obj, TrackOpTypes.HAS, key)
  return obj.hasOwnProperty(key as string)
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
  get(target: Target, key: string | symbol, receiver: object): any {
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
      let fn: Function | undefined
      // 数组且具有特殊Instrumentations的属性访问处理。
      if (targetIsArray && (fn = arrayInstrumentations[key])) {
        return fn
      }
      // 'hasOwnProperty的特殊处理。
      if (key === 'hasOwnProperty') {
        return hasOwnProperty
      }
    }

    const res = Reflect.get(
      target,
      key,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      isRef(target) ? target : receiver,
    )

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
    target: Record<string | symbol, unknown>,
    key: string | symbol,
    value: unknown,
    receiver: object,
  ): boolean {
    // 判断是否为浅响应式，进行相应处理
    let oldValue = target[key]
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
    const result = Reflect.set(
      target,
      key,
      value,
      isRef(target) ? target : receiver,
    )
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
  deleteProperty(
    target: Record<string | symbol, unknown>,
    key: string | symbol,
  ): boolean {
    // 判断是否曾存在该属性，存在则触发相应响应式操作
    const hadKey = hasOwn(target, key)
    const oldValue = target[key]
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
  has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
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
  ownKeys(target: Record<string | symbol, unknown>): (string | symbol)[] {
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
  /*@__PURE__*/ new MutableReactiveHandler()

export const readonlyHandlers: ProxyHandler<object> =
  /*@__PURE__*/ new ReadonlyReactiveHandler()

export const shallowReactiveHandlers: MutableReactiveHandler =
  /*@__PURE__*/ new MutableReactiveHandler(true)

// 浅只读处理器，特殊处理保持只读性和引用的不变性
// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers: ReadonlyReactiveHandler =
  /*@__PURE__*/ new ReadonlyReactiveHandler(true)
