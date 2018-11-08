import { VNodeFlags, ChildrenFlags } from './flags'
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
import {
  handleError,
  ErrorTypes,
  callLifecycleHookWithHandler
} from './errorHandling'
import { warn } from './warning'
import { setCurrentInstance, unsetCurrentInstance } from './experimental/hooks'

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
    callLifecycleHookWithHandler(created, $proxy, ErrorTypes.CREATED)
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
    while (currentContextVNode !== null) {
      if ((currentContextVNode.flags & VNodeFlags.COMPONENT_STATEFUL) > 0) {
        const parentComponent = (currentContextVNode as VNode)
          .children as ComponentInstance
        instance.$parent = parentComponent.$proxy
        instance.$root = parentComponent.$root
        parentComponent.$children.push(proxy)
        break
      }
      currentContextVNode = currentContextVNode.contextVNode
    }
  } else {
    instance.$root = proxy
  }

  // beforeCreate hook is called right in the constructor
  const { beforeCreate, props } = instance.$options
  if (beforeCreate) {
    callLifecycleHookWithHandler(beforeCreate, proxy, ErrorTypes.BEFORE_CREATE)
  }
  initializeProps(instance, props, (currentVNode as VNode).data)
}

export let isRendering = false

export function renderInstanceRoot(instance: ComponentInstance): VNode {
  let vnode
  const {
    $options: { hooks },
    render,
    $proxy,
    $props,
    $slots,
    $attrs,
    $parentVNode
  } = instance
  try {
    setCurrentInstance(instance)
    if (hooks) {
      instance._hookProps = hooks.call($proxy, $props) || null
    }
    if (__DEV__) {
      isRendering = true
    }
    vnode = render.call($proxy, $props, $slots, $attrs, $parentVNode)
    if (__DEV__) {
      isRendering = false
    }
    unsetCurrentInstance()
  } catch (err) {
    handleError(err, instance, ErrorTypes.RENDER)
  }
  return normalizeComponentRoot(vnode, $parentVNode)
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

export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode
): boolean {
  const { data: prevProps, childFlags: prevChildFlags } = prevVNode
  const { data: nextProps, childFlags: nextChildFlags } = nextVNode
  // If has different slots content, or has non-compiled slots,
  // the child needs to be force updated. It's ok to call $forceUpdate
  // again even if props update has already queued an update, as the
  // scheduler will not queue the same update twice.
  if (
    prevChildFlags !== nextChildFlags ||
    (nextChildFlags & ChildrenFlags.DYNAMIC_SLOTS) > 0
  ) {
    return true
  }
  if (prevProps === nextProps) {
    return false
  }
  if (prevProps === null) {
    return nextProps !== null
  }
  if (nextProps === null) {
    return prevProps !== null
  }
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (nextProps[key] !== prevProps[key]) {
      return true
    }
  }
  return false
}

export function getReasonForComponentUpdate(
  prevVNode: VNode,
  nextVNode: VNode
): any {
  // TODO: extract more detailed information on why the component is updating
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
