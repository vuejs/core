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
import { handleError, ErrorTypes } from './errorHandling'

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
  let vnode
  try {
    vnode = instance.render.call(
      instance.$proxy,
      instance.$props,
      instance.$slots
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
      const parentData = componentVNode.data
      if (parentData != null) {
        let extraData: any = null
        for (const key in parentData) {
          // attrs/class/style bindings on parentVNode are merged down to child
          // component root,
          // nativeOn* handlers are merged to child root as normal on* handlers.
          // cloneVNode contains special logic for merging these props with
          // existing values.
          if (key === 'attrs') {
            extraData = extraData || {}
            const { attrs } = parentData
            for (const attr in attrs) {
              extraData[attr] = attrs[attr]
            }
          } else if (key === 'class' || key === 'style') {
            ;(extraData || (extraData = {}))[key] = parentData[key]
          } else if (key.startsWith('nativeOn')) {
            ;(extraData || (extraData = {}))['on' + key.slice(8)] =
              parentData[key]
          }
        }
        if (extraData) {
          vnode = cloneVNode(vnode, extraData)
        }
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
    if (key === 'methods') {
      for (const method in value) {
        ;(ObjectComponent.prototype as any)[method] = value[method]
      }
    }
  }
  return ObjectComponent as ComponentClass
}
