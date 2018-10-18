import { ChildrenFlags } from './flags'
import { ComponentClass, FunctionalComponent, Component } from './component'
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
import { isString, isArray, isFunction, isObject } from '@vue/shared'

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

// TODO improve return type with props information
interface createElement extends VNodeFactories {
  // element
  (tag: string, children?: RawChildrenType): VNode
  (
    tag: string,
    // TODO support native element properties
    data?: VNodeData & Differ | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  // fragment
  (tag: typeof Fragment, children?: RawChildrenType): VNode
  (
    tag: typeof Fragment,
    data?: ({ key?: Key } & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  // portal
  (tag: typeof Portal, children?: RawChildrenType): VNode
  (
    tag: typeof Portal,
    data?: ({ target: any } & BuiltInProps & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  // object
  <P>(tag: OptionsComponent<P>, children?: RawChildrenType): VNode
  <P>(
    tag: OptionsComponent<P>,
    data?: (P & BuiltInProps & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  // functional
  <P>(tag: FunctionalComponent<P>, children?: RawChildrenType): VNode
  <P>(
    tag: FunctionalComponent<P>,
    data?: (P & BuiltInProps & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
  // class
  <P>(tag: new () => Component<P>, children?: RawChildrenType): VNode
  <P>(
    tag: new () => Component<P>,
    data?: (P & BuiltInProps & Differ) | null,
    children?: RawChildrenType | RawSlots
  ): VNode
}

export const h = ((tag: ElementType, data?: any, children?: any): VNode => {
  if (data !== null && (isArray(data) || !isObject(data) || data._isVNode)) {
    children = data
    data = null
  }

  if (data === void 0) data = null
  if (children === void 0) children = null

  // if value is observable, create a clone of original
  // so that we can normalize its class/style
  // since this guard is only placed here, this means any direct createXXXVnode
  // functions only accept fresh data objects.
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

  if (isString(tag)) {
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
    if (__DEV__ && !isFunction(tag) && !isObject(tag)) {
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
