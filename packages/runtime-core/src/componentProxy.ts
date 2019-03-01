import { ComponentInstance } from './component'
import { isFunction } from '@vue/shared'
import { isRendering } from './componentRenderUtils'
import { isReservedKey, reservedMethods } from './componentOptions'
import { warn } from './warning'

const bindCache = new WeakMap()

// TODO: bound methods should also capture/handle errors
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
    let i: any
    if (key === '_self') {
      return target
    } else if ((i = target._rawData) !== null && i.hasOwnProperty(key)) {
      // data
      // make sure to return from $data to register dependency
      return target.$data[key]
    } else if ((i = target.$options.props) != null && i.hasOwnProperty(key)) {
      // props are only proxied if declared
      return target.$props[key]
    } else if (
      (i = target._computedGetters) !== null &&
      i.hasOwnProperty(key)
    ) {
      // computed
      return i[key]()
    } else if (key[0] !== '_') {
      if (__DEV__ && isRendering) {
        if (key in reservedMethods) {
          warn(
            `"${key}" is a reserved method / lifecycle hook and should not be ` +
              `used as a normal method during render.`
          )
        } else if (!(key in target)) {
          warn(
            `property "${key}" was accessed during render but does not exist ` +
              `on instance.`
          )
        }
      }
      const value = Reflect.get(target, key, receiver)
      if (key !== 'constructor' && isFunction(value)) {
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
    let i: any
    if (__DEV__) {
      if (isReservedKey(key) && key in target) {
        warn(`failed setting property "${key}": reserved fields are immutable.`)
        return false
      }
      if ((i = target.$options.props) != null && i.hasOwnProperty(key)) {
        warn(`failed setting property "${key}": props are immutable.`)
        return false
      }
    }
    if ((i = target._rawData) !== null && i.hasOwnProperty(key)) {
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
