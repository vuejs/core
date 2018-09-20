import { unwrap } from './index'
import { track, trigger } from './autorun'
import { OperationTypes } from './operations'

function makeInstrumentedMethod(method: string | symbol, type: OperationTypes) {
  return function(...args: any[]) {
    const target = unwrap(this)
    const proto: any = Reflect.getPrototypeOf(target)
    track(target, type, args[0])
    return proto[method].apply(target, args)
  }
}

const get = makeInstrumentedMethod('get', OperationTypes.GET)
const has = makeInstrumentedMethod('has', OperationTypes.HAS)

function size(target: any) {
  target = unwrap(target)
  const proto = Reflect.getPrototypeOf(target)
  track(target, OperationTypes.ITERATE)
  return Reflect.get(proto, 'size', target)
}

function makeWarning(type: OperationTypes) {
  return function() {
    if (__DEV__) {
      console.warn(
        `${type} operation failed: target is immutable.`,
        unwrap(this)
      )
    }
  }
}

const mutableInstrumentations: any = {
  get,
  has,

  get size() {
    return size(this)
  },

  add(key: any) {
    const target = unwrap(this)
    const proto: any = Reflect.getPrototypeOf(this)
    const hadKey = proto.has.call(target, key)
    const result = proto.add.apply(target, arguments)
    if (!hadKey) {
      if (__DEV__) {
        trigger(target, OperationTypes.ADD, key, { value: key })
      } else {
        trigger(target, OperationTypes.ADD, key)
      }
    }
    return result
  },

  set(key: any, value: any) {
    const target = unwrap(this)
    const proto: any = Reflect.getPrototypeOf(this)
    const hadKey = proto.has.call(target, key)
    const oldValue = proto.get.call(target, key)
    const result = proto.set.apply(target, arguments)
    if (value !== oldValue) {
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
  },

  delete(key: any) {
    const target = unwrap(this)
    const proto: any = Reflect.getPrototypeOf(this)
    const hadKey = proto.has.call(target, key)
    const oldValue = proto.get ? proto.get.call(target, key) : undefined
    // forward the operation before queueing reactions
    const result = proto.delete.apply(target, arguments)
    if (hadKey) {
      if (__DEV__) {
        trigger(target, OperationTypes.DELETE, key, { oldValue })
      } else {
        trigger(target, OperationTypes.DELETE, key)
      }
    }
    return result
  },

  clear() {
    const target = unwrap(this)
    const proto: any = Reflect.getPrototypeOf(this)
    const hadItems = target.size !== 0
    const oldTarget = target instanceof Map ? new Map(target) : new Set(target)
    // forward the operation before queueing reactions
    const result = proto.clear.apply(target, arguments)
    if (hadItems) {
      if (__DEV__) {
        trigger(target, OperationTypes.CLEAR, void 0, { oldTarget })
      } else {
        trigger(target, OperationTypes.CLEAR)
      }
    }
    return result
  }
}

const immutableInstrumentations: any = {
  get,
  has,
  get size() {
    return size(this)
  },
  add: makeWarning(OperationTypes.ADD),
  set: makeWarning(OperationTypes.SET),
  delete: makeWarning(OperationTypes.DELETE),
  clear: makeWarning(OperationTypes.CLEAR)
}
;['forEach', 'keys', 'values', 'entries', Symbol.iterator].forEach(key => {
  mutableInstrumentations[key] = immutableInstrumentations[
    key
  ] = makeInstrumentedMethod(key, OperationTypes.ITERATE)
})

function getInstrumented(
  target: any,
  key: string | symbol,
  receiver: any,
  instrumentations: any
) {
  target = instrumentations.hasOwnProperty(key) ? instrumentations : target
  return Reflect.get(target, key, receiver)
}

export const mutableCollectionHandlers: ProxyHandler<any> = {
  get: (target: any, key: string | symbol, receiver: any) =>
    getInstrumented(target, key, receiver, mutableInstrumentations)
}

export const immutableCollectionHandlers: ProxyHandler<any> = {
  get: (target: any, key: string | symbol, receiver: any) =>
    getInstrumented(target, key, receiver, immutableInstrumentations)
}
