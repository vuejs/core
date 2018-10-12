import { ChildrenFlags } from './flags'
import {
  ComponentClass,
  FunctionalComponent,
  ComponentInstance
} from './component'
import { ComponentOptions } from './componentOptions'
import {
  VNode,
  createElementVNode,
  createComponentVNode,
  createTextVNode,
  createFragment,
  createPortal,
  VNodeData,
  BuiltInProps,
  Key
} from './vdom'
import { isObservable } from '@vue/observer'
import { warn } from './warning'

export const Fragment = Symbol()
export const Portal = Symbol()

type RawChildType = VNode | string | number | boolean | null | undefined

export type RawSlots = {
  [name: string]: () => RawChildrenType
}

export type RawChildrenType = RawChildType | RawChildType[]

export type ElementType =
  | string
  | FunctionalComponent
  | ComponentClass
  | ComponentOptions
  | typeof Fragment
  | typeof Portal

interface VNodeFactories {
  c: typeof createComponentVNode
  e: typeof createElementVNode
  t: typeof createTextVNode
  f: typeof createFragment
  p: typeof createPortal
}

// This is used to differentiate the data object from
// vnodes and arrays
type Differ = { _isVNode?: never; [Symbol.iterator]?: never }

type OptionsComponent<P> =
  | (ComponentOptions<P> & { template: string })
  | (ComponentOptions<P> & { render: Function })

interface createElement extends VNodeFactories {
  // element
  (
    tag: string,
    // TODO support native element properties
    data?: VNodeData & Differ | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  (tag: string, children?: RawChildrenType): VNode
  // fragment
  (
    tag: typeof Fragment,
    data?: ({ key?: Key } & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  (tag: typeof Fragment, children?: RawChildrenType): VNode
  // portal
  (
    tag: typeof Portal,
    data?: ({ target: any } & BuiltInProps & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  (tag: typeof Portal, children?: RawChildrenType): VNode
  // object
  <P>(
    tag: OptionsComponent<P>,
    data?: (P & BuiltInProps & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  <P>(tag: OptionsComponent<P>, children?: RawChildrenType): VNode
  // functional
  <P>(
    tag: FunctionalComponent<P>,
    data?: (P & BuiltInProps & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  <P>(tag: FunctionalComponent<P>, children?: RawChildrenType): VNode
  // class
  <P, T extends ComponentInstance<P>>(
    tag: new () => T & { $props: P },
    data?: (P & BuiltInProps & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  <P, T extends ComponentInstance<P>>(
    tag: new () => T & { $props: P },
    children?: RawChildrenType
  ): VNode
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

  // if value is observable, create a clone of original
  // so that we can normalize its class/style
  if (isObservable(data)) {
    data = Object.assign({}, data)
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
      warn('Ref cannot be used on Fragments. Use it on inner elements instead.')
    }
    return createFragment(children, ChildrenFlags.UNKNOWN_CHILDREN, key)
  } else if (tag === Portal) {
    if (__DEV__ && !portalTarget) {
      warn('Portal must have a target: ', portalTarget)
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
      warn('Invalid component passed to h(): ', tag)
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
