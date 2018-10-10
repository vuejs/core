import { VNodeFlags } from './flags'
import { EMPTY_OBJ } from './utils'
import { h } from './h'
import { VNode, MountedVNode, createFragment } from './vdom'
import { Component, ComponentInstance, ComponentClass } from './component'
import { createTextVNode, cloneVNode } from './vdom'
import { initializeState } from './componentState'
import { initializeProps } from './componentProps'
import {
  initializeComputed,
  resolveComputedOptions,
  teardownComputed
} from './componentComputed'
import { initializeWatch, teardownWatch } from './componentWatch'
import { ComponentOptions } from './componentOptions'
import { createRenderProxy } from './componentProxy'
import { handleError, ErrorTypes } from './errorHandling'

export function createComponentInstance(
  vnode: VNode,
  Component: ComponentClass,
  contextVNode: MountedVNode | null
): ComponentInstance {
  const instance = (vnode.children = new Component()) as ComponentInstance
  instance.$parentVNode = vnode as MountedVNode

  // renderProxy
  const proxy = (instance.$proxy = createRenderProxy(instance))

  // pointer management
  if (contextVNode !== null) {
    // locate first non-functional parent
    while (
      contextVNode !== null &&
      contextVNode.flags & VNodeFlags.COMPONENT_FUNCTIONAL &&
      contextVNode.contextVNode !== null
    ) {
      contextVNode = contextVNode.contextVNode as any
    }
    const parentComponent = (contextVNode as VNode)
      .children as ComponentInstance
    instance.$parent = parentComponent.$proxy
    instance.$root = parentComponent.$root
    parentComponent.$children.push(proxy)
  } else {
    instance.$root = proxy
  }

  // lifecycle
  if (instance.beforeCreate) {
    instance.beforeCreate.call(proxy)
  }
  initializeProps(instance, Component.props, vnode.data)
  initializeState(instance)
  initializeComputed(instance, Component.computed)
  initializeWatch(instance, Component.watch)
  instance.$slots = vnode.slots || EMPTY_OBJ
  if (instance.created) {
    instance.created.call(proxy)
  }

  return instance as ComponentInstance
}

export function renderInstanceRoot(instance: ComponentInstance): VNode {
  let vnode
  try {
    vnode = instance.render.call(
      instance.$proxy,
      instance.$props,
      instance.$slots,
      instance.$attrs
    )
  } catch (e1) {
    handleError(e1, instance, ErrorTypes.RENDER)
    if (__DEV__ && instance.renderError) {
      try {
        vnode = instance.renderError.call(instance.$proxy, e1)
      } catch (e2) {
        handleError(e2, instance, ErrorTypes.RENDER_ERROR)
      }
    }
  }
  return normalizeComponentRoot(vnode, instance.$parentVNode)
}

export function teardownComponentInstance(instance: ComponentInstance) {
  if (instance._unmounted) {
    return
  }
  const parentComponent = instance.$parent && instance.$parent._self
  if (parentComponent && !parentComponent._unmounted) {
    parentComponent.$children.splice(
      parentComponent.$children.indexOf(instance.$proxy),
      1
    )
  }
  teardownComputed(instance)
  teardownWatch(instance)
}

export function normalizeComponentRoot(
  vnode: any,
  componentVNode: VNode | null
): VNode {
  if (vnode == null) {
    vnode = createTextVNode('')
  } else if (typeof vnode !== 'object') {
    vnode = createTextVNode(vnode + '')
  } else if (Array.isArray(vnode)) {
    if (vnode.length === 1) {
      vnode = normalizeComponentRoot(vnode[0], componentVNode)
    } else {
      vnode = createFragment(vnode)
    }
  } else {
    const { el, flags } = vnode
    if (
      componentVNode &&
      (flags & VNodeFlags.COMPONENT || flags & VNodeFlags.ELEMENT)
    ) {
      if (el) {
        vnode = cloneVNode(vnode)
      }
      if (flags & VNodeFlags.COMPONENT) {
        vnode.parentVNode = componentVNode
      }
    } else if (el) {
      vnode = cloneVNode(vnode)
    }
  }
  return vnode
}

export function shouldUpdateFunctionalComponent(
  prevProps: Record<string, any> | null,
  nextProps: Record<string, any> | null
): boolean {
  if (prevProps === nextProps) {
    return false
  }
  if (prevProps === null) {
    return nextProps !== null
  }
  if (nextProps === null) {
    return prevProps !== null
  }
  let shouldUpdate = true
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length === Object.keys(prevProps).length) {
    shouldUpdate = false
    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i]
      if (nextProps[key] !== prevProps[key]) {
        shouldUpdate = true
      }
    }
  }
  return shouldUpdate
}

export function createComponentClassFromOptions(
  options: ComponentOptions
): ComponentClass {
  class AnonymousComponent extends Component {
    static options = options
  }
  const proto = AnonymousComponent.prototype as any
  for (const key in options) {
    const value = options[key]
    // name -> displayName
    if (key === 'name') {
      AnonymousComponent.displayName = options.name
    } else if (typeof value === 'function') {
      if (__COMPAT__) {
        if (key === 'render') {
          proto[key] = function() {
            return value.call(this, h)
          }
        } else if (key === 'beforeDestroy') {
          proto.beforeUnmount = value
        } else if (key === 'destroyed') {
          proto.unmounted = value
        } else {
          proto[key] = value
        }
      } else {
        proto[key] = value
      }
    } else if (key === 'computed') {
      AnonymousComponent.computed = value
      for (const computedKey in value) {
        const computed = value[computedKey]
        const isGet = typeof computed === 'function'
        Object.defineProperty(proto, computedKey, {
          configurable: true,
          get: isGet ? computed : computed.get,
          set: isGet ? undefined : computed.set
        })
      }
    } else if (key === 'methods') {
      for (const method in value) {
        if (__DEV__ && proto.hasOwnProperty(method)) {
          console.warn(
            `Object syntax contains method name that conflicts with ` +
              `lifecycle hook: "${method}"`
          )
        }
        proto[method] = value[method]
      }
    } else {
      ;(AnonymousComponent as any)[key] = value
    }
  }
  return AnonymousComponent as ComponentClass
}

export function resolveComponentOptions(
  Component: ComponentClass
): ComponentOptions {
  const keys = Object.keys(Component)
  const options = {} as any
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    options[key] = (Component as any)[key]
  }
  Component.computed = options.computed = resolveComputedOptions(Component)
  Component.options = options
  return options
}
