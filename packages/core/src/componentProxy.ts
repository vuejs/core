import { ComponentInstance } from './component'

const bindCache = new WeakMap()

function getBoundMethod(fn: Function, target: any, receiver: any): Function {
  let boundMethodsForTarget = bindCache.get(target)
  if (boundMethodsForTarget === void 0) {
    bindCache.set(target, (boundMethodsForTarget = new Map()))
  }
  let boundFn = boundMethodsForTarget.get(fn)
  if (boundFn === void 0) {
    boundMethodsForTarget.set(fn, (boundFn = fn.bind(receiver)))
  }
  return boundFn
}

const renderProxyHandlers = {
  get(target: ComponentInstance<any, any>, key: string, receiver: any) {
    if (key === '_self') {
      return target
    } else if (
      target._rawData !== null &&
      target._rawData.hasOwnProperty(key)
    ) {
      // data
      return target.$data[key]
    } else if (
      target.$options.props != null &&
      target.$options.props.hasOwnProperty(key)
    ) {
      // props are only proxied if declared
      return target.$props[key]
    } else if (
      target._computedGetters !== null &&
      target._computedGetters.hasOwnProperty(key)
    ) {
      // computed
      return target._computedGetters[key]()
    } else {
      if (__DEV__ && !(key in target)) {
        // TODO warn non-present property
      }
      const value = Reflect.get(target, key, receiver)
      if (typeof value === 'function') {
        // auto bind
        return getBoundMethod(value, target, receiver)
      } else {
        return value
      }
    }
  },
  set(
    target: ComponentInstance<any, any>,
    key: string,
    value: any,
    receiver: any
  ): boolean {
    if (__DEV__) {
      if (typeof key === 'string' && key[0] === '$') {
        // TODO warn setting immutable properties
        return false
      }
      if (
        target.$options.props != null &&
        target.$options.props.hasOwnProperty(key)
      ) {
        // TODO warn props are immutable
        return false
      }
    }
    if (target._rawData !== null && target._rawData.hasOwnProperty(key)) {
      target.$data[key] = value
      return true
    } else {
      return Reflect.set(target, key, value, receiver)
    }
  }
}

export function createRenderProxy(instance: any): ComponentInstance {
  return new Proxy(instance, renderProxyHandlers) as ComponentInstance
}
