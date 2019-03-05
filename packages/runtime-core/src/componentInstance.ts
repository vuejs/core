import { VNode, MountedVNode } from './vdom'
import { ComponentInstance, ComponentClass } from './component'
import { initializeState } from './componentState'
import { initializeProps } from './componentProps'
import { initializeWatch, teardownWatch } from './componentWatch'
import { initializeComputed, teardownComputed } from './componentComputed'
import { ComponentProxy, createRenderProxy } from './componentProxy'
import { resolveComponentOptionsFromClass } from './componentOptions'
import { VNodeFlags } from './flags'
import { ErrorTypes, callLifecycleHookWithHandler } from './errorHandling'
import { stop } from '@vue/observer'
import { EMPTY_OBJ } from '@vue/shared'

let currentVNode: VNode | null = null
let currentContextVNode: VNode | null = null

export function createComponentInstance(vnode: VNode): ComponentInstance {
  // component instance creation is done in two steps.
  // first, `initializeComponentInstance` is called inside base component
  // constructor as the instance is created so that the extended component's
  // constructor has access to public properties and most importantly props.
  // we are storing the vnodes in variables here so that there's no need to
  // always pass args in super()
  currentVNode = vnode
  currentContextVNode = vnode.contextVNode
  const Component = vnode.tag as ComponentClass
  const instanceProxy = new Component() as ComponentProxy
  const instance = instanceProxy._self

  // then we finish the initialization by collecting properties set on the
  // instance
  const {
    $options: { created, computed, watch }
  } = instance
  initializeState(instance, !Component.fromOptions)
  initializeComputed(instance, computed)
  initializeWatch(instance, watch)
  instance.$slots = currentVNode.slots || EMPTY_OBJ

  if (created) {
    callLifecycleHookWithHandler(created, instanceProxy, ErrorTypes.CREATED)
  }

  currentVNode = currentContextVNode = null
  return instance
}

// this is called inside the base component's constructor
// it initializes all the way up to props so that they are available
// inside the extended component's constructor, and returns the proxy of the
// raw instance.
export function initializeComponentInstance<T extends ComponentInstance>(
  instance: T
): ComponentProxy<T> {
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

  return proxy
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
