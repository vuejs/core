import { unwrap, observable, immutable } from './index'
import { track, trigger } from './autorun'
import { OperationTypes } from './operations'
import { LOCKED } from './lock'
import { isObject } from '@vue/shared'

const toObservable = (value: any) =>
  isObject(value) ? observable(value) : value
const toImmutable = (value: any) => (isObject(value) ? immutable(value) : value)

function get(target: any, key: any, wrap: (t: any) => any): any {
  target = unwrap(target)
  key = unwrap(key)
  const proto: any = Reflect.getPrototypeOf(target)
  track(target, OperationTypes.GET, key)
  const res = proto.get.call(target, key)
  return wrap(res)
}

function has(key: any): boolean {
  const target = unwrap(this)
  key = unwrap(key)
  const proto: any = Reflect.getPrototypeOf(target)
  track(target, OperationTypes.HAS, key)
  return proto.has.call(target, key)
}

function size(target: any) {
  target = unwrap(target)
  const proto = Reflect.getPrototypeOf(target)
  track(target, OperationTypes.ITERATE)
  return Reflect.get(proto, 'size', target)
}

function add(value: any) {
  value = unwrap(value)
  const target = unwrap(this)
  const proto: any = Reflect.getPrototypeOf(this)
  const hadKey = proto.has.call(target, value)
  const result = proto.add.call(target, value)
  if (!hadKey) {
    /* istanbul ignore else */
    if (__DEV__) {
      trigger(target, OperationTypes.ADD, value, { value })
    } else {
      trigger(target, OperationTypes.ADD, value)
    }
  }
  return result
}

function set(key: any, value: any) {
  value = unwrap(value)
  const target = unwrap(this)
  const proto: any = Reflect.getPrototypeOf(this)
  const hadKey = proto.has.call(target, key)
  const oldValue = proto.get.call(target, key)
  const result = proto.set.call(target, key, value)
  if (value !== oldValue) {
    /* istanbul ignore else */
    if (__DEV__) {
      const extraInfo = { oldValue, newValue: value }
      if (!hadKey) {
        trigger(target, OperationTypes.ADD, key, extraInfo)
      } else {
        trigger(target, OperationTypes.SET, key, extraInfo)
      }
    } else {
      if (!hadKey) {
        trigger(target, OperationTypes.ADD, key)
      } else {
        trigger(target, OperationTypes.SET, key)
      }
    }
  }
  return result
}

function deleteEntry(key: any) {
  const target = unwrap(this)
  const proto: any = Reflect.getPrototypeOf(this)
  const hadKey = proto.has.call(target, key)
  const oldValue = proto.get ? proto.get.call(target, key) : undefined
  // forward the operation before queueing reactions
  const result = proto.delete.call(target, key)
  if (hadKey) {
    /* istanbul ignore else */
    if (__DEV__) {
      trigger(target, OperationTypes.DELETE, key, { oldValue })
    } else {
      trigger(target, OperationTypes.DELETE, key)
    }
  }
  return result
}

function clear() {
  const target = unwrap(this)
  const proto: any = Reflect.getPrototypeOf(this)
  const hadItems = target.size !== 0
  const oldTarget = target instanceof Map ? new Map(target) : new Set(target)
  // forward the operation before queueing reactions
  const result = proto.clear.call(target)
  if (hadItems) {
    /* istanbul ignore else */
    if (__DEV__) {
      trigger(target, OperationTypes.CLEAR, void 0, { oldTarget })
    } else {
      trigger(target, OperationTypes.CLEAR)
    }
  }
  return result
}

function createForEach(isImmutable: boolean) {
  return function forEach(callback: Function, thisArg?: any) {
    const observed = this
    const target = unwrap(observed)
    const proto: any = Reflect.getPrototypeOf(target)
    const wrap = isImmutable ? toImmutable : toObservable
    track(target, OperationTypes.ITERATE)
    // important: create sure the callback is
    // 1. invoked with the observable map as `this` and 3rd arg
    // 2. the value received should be a corresponding observable/immutable.
    function wrappedCallback(value: any, key: any) {
      return callback.call(observed, wrap(value), wrap(key), observed)
    }
    return proto.forEach.call(target, wrappedCallback, thisArg)
  }
}

function createIterableMethod(method: string | symbol, isImmutable: boolean) {
  return function(...args: any[]) {
    const target = unwrap(this)
    const proto: any = Reflect.getPrototypeOf(target)
    const isPair =
      method === 'entries' ||
      (method === Symbol.iterator && target instanceof Map)
    const innerIterator = proto[method].apply(target, args)
    const wrap = isImmutable ? toImmutable : toObservable
    track(target, OperationTypes.ITERATE)
    // return a wrapped iterator which returns observed versions of the
    // values emitted from the real iterator
    return {
      // iterator protocol
      next() {
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            }
      },
      // iterable protocol
      [Symbol.iterator]() {
        return this
      }
    }
  }
}

function createImmutableMethod(
  method: Function,
  type: OperationTypes
): Function {
  return function(...args: any[]) {
    if (LOCKED) {
      if (__DEV__) {
        const key = args[0] ? `on key "${args[0]}"` : ``
        console.warn(
          `${type} operation ${key}failed: target is immutable.`,
          unwrap(this)
        )
      }
      return type === OperationTypes.DELETE ? false : this
    } else {
      return method.apply(this, args)
    }
  }
}

const mutableInstrumentations: any = {
  get(key: any) {
    return get(this, key, toObservable)
  },
  get size() {
    return size(this)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false)
}

const immutableInstrumentations: any = {
  get(key: any) {
    return get(this, key, toImmutable)
  },
  get size() {
    return size(this)
  },
  has,
  add: createImmutableMethod(add, OperationTypes.ADD),
  set: createImmutableMethod(set, OperationTypes.SET),
  delete: createImmutableMethod(deleteEntry, OperationTypes.DELETE),
  clear: createImmutableMethod(clear, OperationTypes.CLEAR),
  forEach: createForEach(true)
}

const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
iteratorMethods.forEach(method => {
  mutableInstrumentations[method] = createIterableMethod(method, false)
  immutableInstrumentations[method] = createIterableMethod(method, true)
})

function createInstrumentationGetter(instrumentations: any) {
  return function getInstrumented(
    target: any,
    key: string | symbol,
    receiver: any
  ) {
    target =
      instrumentations.hasOwnProperty(key) && key in target
        ? instrumentations
        : target
    return Reflect.get(target, key, receiver)
  }
}

export const mutableCollectionHandlers: ProxyHandler<any> = {
  get: createInstrumentationGetter(mutableInstrumentations)
}

export const immutableCollectionHandlers: ProxyHandler<any> = {
  get: createInstrumentationGetter(immutableInstrumentations)
}
