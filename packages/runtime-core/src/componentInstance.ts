import { VNode, MountedVNode } from './vdom'
import { Component, ComponentInstance, ComponentClass } from './component'
import { initializeState } from './componentState'
import { initializeProps } from './componentProps'
import { initializeWatch, teardownWatch } from './componentWatch'
import { initializeComputed, teardownComputed } from './componentComputed'
import { createRenderProxy } from './componentProxy'
import { resolveComponentOptionsFromClass } from './componentOptions'
import { VNodeFlags } from './flags'
import { ErrorTypes, callLifecycleHookWithHandler } from './errorHandling'
import { stop } from '@vue/observer'
import { EMPTY_OBJ } from '@vue/shared'

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

export function teardownComponentInstance(instance: ComponentInstance) {
  const parentComponent = instance.$parent && instance.$parent._self
  if (parentComponent && !parentComponent._unmounted) {
    parentComponent.$children.splice(
      parentComponent.$children.indexOf(instance.$proxy),
      1
    )
  }
  stop(instance._update)
  teardownComputed(instance)
  teardownWatch(instance)
}
