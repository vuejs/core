import { reactive, readonly, toRaw } from './reactive'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { track, trigger, ITERATE_KEY } from './effect'
import { LOCKED } from './lock'
import { isObject, hasOwn, isSymbol, hasChanged, isArray } from '@vue/shared'
import { isRef } from './ref'

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => (Symbol as any)[key])
    .filter(isSymbol)
)

const get = /*#__PURE__*/ createGetter()
const shallowReactiveGet = /*#__PURE__*/ createGetter(false, true)
const readonlyGet = /*#__PURE__*/ createGetter(true)
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true)

const arrayIdentityInstrumentations: Record<string, Function> = {}
;['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
  arrayIdentityInstrumentations[key] = function(
    value: unknown,
    ...args: any[]
  ): any {
    return toRaw(this)[key](toRaw(value), ...args)
  }
})

function createGetter(isReadonly = false, shallow = false) {
  return function get(target: object, key: string | symbol, receiver: object) {
    if (isArray(target) && hasOwn(arrayIdentityInstrumentations, key)) {
      return Reflect.get(arrayIdentityInstrumentations, key, receiver)
    }
    const res = Reflect.get(target, key, receiver)
    if (isSymbol(key) && builtInSymbols.has(key)) {
      return res
    }
    if (shallow) {
      track(target, TrackOpTypes.GET, key)
      // TODO strict mode that returns a shallow-readonly version of the value
      return res
    }
    if (isRef(res)) {
      return res.value
    }
    track(target, TrackOpTypes.GET, key)
    return isObject(res)
      ? isReadonly
        ? // need to lazy access readonly and reactive here to avoid
          // circular dependency
          readonly(res)
        : reactive(res)
      : res
  }
}

const set = /*#__PURE__*/ createSetter()
const shallowReactiveSet = /*#__PURE__*/ createSetter(false, true)
const readonlySet = /*#__PURE__*/ createSetter(true)
const shallowReadonlySet = /*#__PURE__*/ createSetter(true, true)

function createSetter(isReadonly = false, shallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    if (isReadonly && LOCKED) {
      if (__DEV__) {
        console.warn(
          `Set operation on key "${String(key)}" failed: target is readonly.`,
          target
        )
      }
      return true
    }

    const oldValue = (target as any)[key]
    if (!shallow) {
      value = toRaw(value)
      if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
        return true
      }
    } else {
      // in shallow mode, objects are set as-is regardless of reactive or not
    }

    const hadKey = hasOwn(target, key)
    const result = Reflect.set(target, key, value, receiver)
    // don't trigger if target is something up in the prototype chain of original
    if (target === toRaw(receiver)) {
      /* istanbul ignore else */
      if (__DEV__) {
        const extraInfo = { oldValue, newValue: value }
        if (!hadKey) {
          trigger(target, TriggerOpTypes.ADD, key, extraInfo)
        } else if (hasChanged(value, oldValue)) {
          trigger(target, TriggerOpTypes.SET, key, extraInfo)
        }
      } else {
        if (!hadKey) {
          trigger(target, TriggerOpTypes.ADD, key)
        } else if (hasChanged(value, oldValue)) {
          trigger(target, TriggerOpTypes.SET, key)
        }
      }
    }
    return result
  }
}

function deleteProperty(target: object, key: string | symbol): boolean {
  const hadKey = hasOwn(target, key)
  const oldValue = (target as any)[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    /* istanbul ignore else */
    if (__DEV__) {
      trigger(target, TriggerOpTypes.DELETE, key, { oldValue })
    } else {
      trigger(target, TriggerOpTypes.DELETE, key)
    }
  }
  return result
}

function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key)
  track(target, TrackOpTypes.HAS, key)
  return result
}

function ownKeys(target: object): (string | number | symbol)[] {
  track(target, TrackOpTypes.ITERATE, ITERATE_KEY)
  return Reflect.ownKeys(target)
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys
}

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set: readonlySet,
  has,
  ownKeys,
  deleteProperty(target: object, key: string | symbol): boolean {
    if (LOCKED) {
      if (__DEV__) {
        console.warn(
          `Delete operation on key "${String(
            key
          )}" failed: target is readonly.`,
          target
        )
      }
      return true
    } else {
      return deleteProperty(target, key)
    }
  }
}

export const shallowReactiveHandlers: ProxyHandler<object> = {
  ...mutableHandlers,
  get: shallowReactiveGet,
  set: shallowReactiveSet
}

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers: ProxyHandler<object> = {
  ...readonlyHandlers,
  get: shallowReadonlyGet,
  set: shallowReadonlySet
}
