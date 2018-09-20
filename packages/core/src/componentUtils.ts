import { VNodeFlags } from './flags'
import { EMPTY_OBJ } from './utils'
import { h } from './h'
import { VNode, createFragment } from './vdom'
import { Component, MountedComponent, ComponentClass } from './component'
import { createTextVNode, cloneVNode } from './vdom'
import { initializeState } from './componentState'
import { initializeProps } from './componentProps'
import {
  initializeComputed,
  getComputedOptions,
  teardownComputed
} from './componentComputed'
import { initializeWatch, teardownWatch } from './componentWatch'
import { Data, ComponentOptions } from './componentOptions'
import { createRenderProxy } from './componentProxy'

export function createComponentInstance(
  vnode: VNode,
  Component: ComponentClass,
  parentComponent: MountedComponent | null
): MountedComponent {
  const instance = (vnode.children = new Component()) as MountedComponent
  instance.$parentVNode = vnode

  // renderProxy
  const proxy = (instance.$proxy = createRenderProxy(instance))

  // pointer management
  if (parentComponent) {
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
  // TODO provide/inject
  initializeProps(instance, vnode.data)
  initializeState(instance)
  initializeComputed(instance, getComputedOptions(Component))
  initializeWatch(instance, instance.$options.watch)
  instance.$slots = vnode.slots || EMPTY_OBJ
  if (instance.created) {
    instance.created.call(proxy)
  }

  return instance as MountedComponent
}

export function renderInstanceRoot(instance: MountedComponent) {
  // TODO handle render error
  return normalizeComponentRoot(
    instance.render.call(instance.$proxy, instance.$props, instance.$slots),
    instance.$parentVNode
  )
}

export function teardownComponentInstance(instance: MountedComponent) {
  const parentComponent = instance.$parent && instance.$parent._self
  if (parentComponent && !parentComponent._destroyed) {
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
    vnode = createFragment(vnode)
  } else {
    const { flags } = vnode
    // parentVNode data merge down
    if (
      componentVNode &&
      (flags & VNodeFlags.COMPONENT || flags & VNodeFlags.ELEMENT)
    ) {
      const parentData = componentVNode.data || EMPTY_OBJ
      const childData = vnode.data || EMPTY_OBJ
      let extraData: any = null
      for (const key in parentData) {
        // class/style bindings on parentVNode are merged down to child
        // component root.
        if (key === 'class') {
          ;(extraData || (extraData = {})).class = childData.class
            ? [].concat(childData.class, parentData.class)
            : parentData.class
        } else if (key === 'style') {
          ;(extraData || (extraData = {})).style = childData.style
            ? [].concat(childData.style, parentData.style)
            : parentData.style
        } else if (key.startsWith('nativeOn')) {
          // nativeOn* handlers are merged down to child root as native listeners
          const event = 'on' + key.slice(8)
          ;(extraData || (extraData = {}))[event] = childData.event
            ? [].concat(childData.event, parentData[key])
            : parentData[key]
        }
      }
      if (extraData) {
        vnode = cloneVNode(vnode, extraData)
      }
      if (vnode.el) {
        vnode = cloneVNode(vnode)
      }
      if (flags & VNodeFlags.COMPONENT) {
        vnode.parentVNode = componentVNode
      }
    } else if (vnode.el) {
      vnode = cloneVNode(vnode)
    }
  }
  return vnode
}

export function shouldUpdateFunctionalComponent(
  prevProps: Data | null,
  nextProps: Data | null
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

// compat only
export function createComponentClassFromOptions(
  options: ComponentOptions
): ComponentClass {
  class ObjectComponent extends Component {
    constructor() {
      super()
      this.$options = options
    }
  }
  for (const key in options) {
    const value = options[key]
    if (typeof value === 'function') {
      ;(ObjectComponent.prototype as any)[key] =
        key === 'render'
          ? // normalize render for legacy signature
            function render() {
              return value.call(this, h)
            }
          : value
    }
    if (key === 'computed') {
      const isGet = typeof value === 'function'
      Object.defineProperty(ObjectComponent.prototype, key, {
        configurable: true,
        get: isGet ? value : value.get,
        set: isGet ? undefined : value.set
      })
    }
  }
  return ObjectComponent as ComponentClass
}
