import { VNodeFlags } from './flags'
import { EMPTY_OBJ } from './utils'
import { h } from './h'
import { VNode, MountedVNode, createFragment } from './vdom'
import {
  Component,
  ComponentInstance,
  ComponentClass,
  FunctionalComponent
} from './component'
import { createTextVNode, cloneVNode } from './vdom'
import { initializeState } from './componentState'
import { initializeProps, resolveProps } from './componentProps'
import {
  initializeComputed,
  resolveComputedOptions,
  teardownComputed
} from './componentComputed'
import { initializeWatch, teardownWatch } from './componentWatch'
import { ComponentOptions } from './componentOptions'
import { createRenderProxy } from './componentProxy'
import { handleError, ErrorTypes } from './errorHandling'
import { warn } from './warning'

let currentVNode: VNode | null = null
let currentContextVNode: VNode | null = null

export function createComponentInstance(
  vnode: VNode,
  Component: ComponentClass
): ComponentInstance {
  // component instance creation is done in two steps.
  // first, `initializeComponentInstance` is called inside base component
  // constructor as the instance is created so that the extended component's
  // constructor has access to certain properties and most importantly,
  // this.$props.
  // we are storing the vnodes in variables here so that there's no need to
  // always pass args in super()
  currentVNode = vnode
  currentContextVNode = vnode.contextVNode
  const instance = (vnode.children = new Component() as ComponentInstance)
  // then we finish the initialization by collecting properties set on the
  // instance
  initializeState(instance)
  initializeComputed(instance, Component.computed)
  initializeWatch(instance, Component.watch)
  instance.$slots = currentVNode.slots || EMPTY_OBJ
  if (instance.created) {
    instance.created.call(instance.$proxy)
  }
  currentVNode = currentContextVNode = null
  return instance
}

// this is called inside the base component's constructor
// it initializes all the way up to props so that they are available
// inside the extended component's constructor
export function initializeComponentInstance(instance: ComponentInstance) {
  if (__DEV__ && currentVNode === null) {
    throw new Error(
      `Component classes are not meant to be manually instantiated.`
    )
  }

  instance.$options = resolveComponentOptions(instance.constructor)
  instance.$parentVNode = currentVNode as MountedVNode

  // renderProxy
  const proxy = (instance.$proxy = createRenderProxy(instance))

  // parent chain management
  if (currentContextVNode !== null) {
    // locate first non-functional parent
    while (
      currentContextVNode !== null &&
      currentContextVNode.flags & VNodeFlags.COMPONENT_FUNCTIONAL &&
      currentContextVNode.contextVNode !== null
    ) {
      currentContextVNode = currentContextVNode.contextVNode as any
    }
    const parentComponent = (currentContextVNode as VNode)
      .children as ComponentInstance
    instance.$parent = parentComponent.$proxy
    instance.$root = parentComponent.$root
    parentComponent.$children.push(proxy)
  } else {
    instance.$root = proxy
  }

  // beforeCreate hook is called right in the constructor
  if (instance.beforeCreate) {
    instance.beforeCreate.call(proxy)
  }
  initializeProps(
    instance,
    instance.constructor.props,
    (currentVNode as VNode).data
  )
}

export function renderInstanceRoot(instance: ComponentInstance): VNode {
  let vnode
  try {
    vnode = instance.render.call(
      instance.$proxy,
      instance.$props,
      instance.$slots,
      instance.$attrs,
      instance.$parentVNode
    )
  } catch (err) {
    handleError(err, instance, ErrorTypes.RENDER)
  }
  return normalizeComponentRoot(vnode, instance.$parentVNode)
}

export function renderFunctionalRoot(vnode: VNode): VNode {
  const render = vnode.tag as FunctionalComponent
  const { props, attrs } = resolveProps(vnode.data, render.props)
  let subTree
  try {
    subTree = render(props, vnode.slots || EMPTY_OBJ, attrs || EMPTY_OBJ, vnode)
  } catch (err) {
    handleError(err, vnode, ErrorTypes.RENDER)
  }
  return normalizeComponentRoot(subTree, vnode)
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

function normalizeComponentRoot(
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
          warn(
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
  if (Component.options) {
    return Component.options
  }
  const descriptors = Object.getOwnPropertyDescriptors(Component)
  const options = {} as any
  for (const key in descriptors) {
    const descriptor = descriptors[key]
    if (descriptor.enumerable || descriptor.get) {
      options[key] = descriptor.get ? descriptor.get() : descriptor.value
    }
  }
  Component.computed = options.computed = resolveComputedOptions(Component)
  Component.options = options
  return options
}
