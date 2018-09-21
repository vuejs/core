import { unwrap, observable, immutable } from './index'
import { track, trigger } from './autorun'
import { OperationTypes } from './operations'
import { LOCKED } from './lock'

function get(target: any, key: any, toObservable: (t: any) => any): any {
  target = unwrap(target)
  key = unwrap(key)
  const proto: any = Reflect.getPrototypeOf(target)
  track(target, OperationTypes.GET, key)
  const res = proto.get.call(target, key)
  return res !== null && typeof res === 'object' ? toObservable(res) : res
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

function makeImmutableMethod(method: Function, type: OperationTypes): Function {
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
    return get(this, key, observable)
  },
  get size() {
    return size(this)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear
}

const immutableInstrumentations: any = {
  get(key: any) {
    return get(this, key, immutable)
  },
  get size() {
    return size(this)
  },
  has,
  add: makeImmutableMethod(add, OperationTypes.ADD),
  set: makeImmutableMethod(set, OperationTypes.SET),
  delete: makeImmutableMethod(deleteEntry, OperationTypes.DELETE),
  clear: makeImmutableMethod(clear, OperationTypes.CLEAR)
}
;['forEach', 'keys', 'values', 'entries', Symbol.iterator].forEach(method => {
  mutableInstrumentations[method] = immutableInstrumentations[
    method
  ] = function(...args: any[]) {
    const target = unwrap(this)
    const proto: any = Reflect.getPrototypeOf(target)
    track(target, OperationTypes.ITERATE)
    return proto[method].apply(target, args)
  }
})

function makeInstrumentationGetter(instrumentations: any) {
  return function getInstrumented(
    target: any,
    key: string | symbol,
    receiver: any
  ) {
    target = instrumentations.hasOwnProperty(key) ? instrumentations : target
    return Reflect.get(target, key, receiver)
  }
}

export const mutableCollectionHandlers: ProxyHandler<any> = {
  get: makeInstrumentationGetter(mutableInstrumentations)
}

export const immutableCollectionHandlers: ProxyHandler<any> = {
  get: makeInstrumentationGetter(immutableInstrumentations)
}
