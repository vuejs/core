import { ChildrenFlags } from './flags'
import { ComponentClass, FunctionalComponent } from './component'
import { ComponentOptions } from './componentOptions'
import {
  VNode,
  createElementVNode,
  createComponentVNode,
  createTextVNode,
  createFragment,
  createPortal
} from './vdom'

export const Fragment = Symbol()
export const Portal = Symbol()

type ElementType =
  | string
  | FunctionalComponent
  | ComponentClass
  | ComponentOptions
  | typeof Fragment
  | typeof Portal

export interface createElement {
  (tag: ElementType, data?: any, children?: any): VNode
  c: typeof createComponentVNode
  e: typeof createElementVNode
  t: typeof createTextVNode
  f: typeof createFragment
  p: typeof createPortal
}

export const h = ((tag: ElementType, data?: any, children?: any): VNode => {
  if (Array.isArray(data) || (data !== void 0 && typeof data !== 'object')) {
    children = data
    data = null
  }

  // TODO clone data if it is observed

  let key = null
  let ref = null
  let portalTarget = null
  if (data != null) {
    if (data.slots != null) {
      children = data.slots
    }
    if (data.key != null) {
      ;({ key } = data)
    }
    if (data.ref != null) {
      ;({ ref } = data)
    }
    if (data.target != null) {
      portalTarget = data.target
    }
  }

  if (typeof tag === 'string') {
    // element
    return createElementVNode(
      tag,
      data,
      children,
      ChildrenFlags.UNKNOWN_CHILDREN,
      key,
      ref
    )
  } else if (tag === Fragment) {
    if (__DEV__ && ref) {
      // TODO warn fragment cannot have ref
    }
    return createFragment(children, ChildrenFlags.UNKNOWN_CHILDREN, key)
  } else if (tag === Portal) {
    if (__DEV__ && !portalTarget) {
      // TODO warn portal must have a target
    }
    return createPortal(
      portalTarget,
      children,
      ChildrenFlags.UNKNOWN_CHILDREN,
      key,
      ref
    )
  } else {
    // component
    return createComponentVNode(
      tag,
      data,
      children,
      ChildrenFlags.UNKNOWN_CHILDREN,
      key,
      ref
    )
  }
}) as createElement

h.c = createComponentVNode
h.e = createElementVNode
h.t = createTextVNode
h.f = createFragment
h.p = createPortal
