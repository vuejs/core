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
import { isObservable } from '@vue/observer'

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
  if (
    Array.isArray(data) ||
    (data != null && (typeof data !== 'object' || data._isVNode))
  ) {
    children = data
    data = null
  }

  if (data === void 0) data = null
  if (children === void 0) children = null

  if (__DEV__ && isObservable(data)) {
    console.warn(
      `Do not used observed state as VNode data - always create fresh objects.`,
      data
    )
  }

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
      console.warn(
        'Ref cannot be used on Fragments. Use it on inner elements instead.'
      )
    }
    return createFragment(children, ChildrenFlags.UNKNOWN_CHILDREN, key)
  } else if (tag === Portal) {
    if (__DEV__ && !portalTarget) {
      console.warn('Portal must have a target: ', portalTarget)
    }
    return createPortal(
      portalTarget,
      children,
      ChildrenFlags.UNKNOWN_CHILDREN,
      key,
      ref
    )
  } else {
    if (
      __DEV__ &&
      (!tag || (typeof tag !== 'function' && typeof tag !== 'object'))
    ) {
      console.warn('Invalid component passed to h(): ', tag)
    }
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
