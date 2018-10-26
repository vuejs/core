import { VNodeFlags } from './flags'
import { EMPTY_OBJ, isArray, isObject } from '@vue/shared'
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
import { initializeComputed, teardownComputed } from './componentComputed'
import { initializeWatch, teardownWatch } from './componentWatch'
import {
  ComponentOptions,
  resolveComponentOptionsFromClass
} from './componentOptions'
import { createRenderProxy } from './componentProxy'
import { handleError, ErrorTypes } from './errorHandling'
import { warn } from './warning'

let currentVNode: VNode | null = null
let currentContextVNode: VNode | null = null

export function createComponentInstance<T extends Component>(
  vnode: VNode
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
  const Component = vnode.tag as ComponentClass
  const instance = (vnode.children = new Component() as ComponentInstance)

  // then we finish the initialization by collecting properties set on the
  // instance
  const {
    $proxy,
    $options: { created, computed, watch }
  } = instance
  initializeState(instance, !Component.fromOptions)
  initializeComputed(instance, computed)
  initializeWatch(instance, watch)
  instance.$slots = currentVNode.slots || EMPTY_OBJ

  if (created) {
    created.call($proxy)
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

  instance.$options = resolveComponentOptionsFromClass(instance.constructor)
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
  const { beforeCreate, props } = instance.$options
  if (beforeCreate) {
    beforeCreate.call(proxy)
  }
  initializeProps(instance, props, (currentVNode as VNode).data)
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
  const [props, attrs] = resolveProps(vnode.data, render.props)
  let subTree
  try {
    subTree = render(props, vnode.slots || EMPTY_OBJ, attrs, vnode)
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
  } else if (!isObject(vnode)) {
    vnode = createTextVNode(vnode + '')
  } else if (isArray(vnode)) {
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
        vnode = cloneVNode(vnode as VNode)
      }
      if (flags & VNodeFlags.COMPONENT) {
        vnode.parentVNode = componentVNode
      }
    } else if (el) {
      vnode = cloneVNode(vnode as VNode)
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
    // indicate this component was created from options
    static fromOptions = true
  }
  const proto = AnonymousComponent.prototype as any
  for (const key in options) {
    const value = options[key]
    if (key === 'render') {
      if (__COMPAT__) {
        options.render = function() {
          return value.call(this, h)
        }
      }
      // so that we can call instance.render directly
      proto.render = options.render
    } else if (key === 'computed') {
      // create computed setters on prototype
      // (getters are handled by the render proxy)
      for (const computedKey in value) {
        const computed = value[computedKey]
        const set = isObject(computed) && computed.set
        if (set) {
          Object.defineProperty(proto, computedKey, {
            configurable: true,
            set
          })
        }
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
    } else if (__COMPAT__) {
      if (key === 'name') {
        options.displayName = value
      } else if (key === 'render') {
        options.render = function() {
          return value.call(this, h)
        }
      } else if (key === 'beforeDestroy') {
        options.beforeUnmount = value
      } else if (key === 'destroyed') {
        options.unmounted = value
      }
    }
  }
  return AnonymousComponent as ComponentClass
}
