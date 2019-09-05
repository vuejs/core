import {
  VNodeTypes,
  VNode,
  createVNode,
  VNodeChildren,
  Fragment,
  Portal
} from './vnode'
import { isObject, isArray } from '@vue/shared'
import { Ref } from '@vue/reactivity'
import { RawSlots } from './componentSlots'
import {
  FunctionalComponent,
  ComponentOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithProps
} from './component'
import { ExtractPropTypes } from './componentProps'

// `h` is a more user-friendly version of `createVNode` that allows omitting the
// props when possible. It is intended for manually written render functions.
// Compiler-generated code uses `createVNode` because
// 1. it is monomorphic and avoids the extra call overhead
// 2. it allows specifying patchFlags for optimization

/*
// type only
h('div')

// type + props
h('div', {})

// type + omit props + children
// Omit props does NOT support named slots
h('div', []) // array
h('div', () => {}) // default slot
h('div', 'foo') // text

// type + props + children
h('div', {}, []) // array
h('div', {}, () => {}) // default slot
h('div', {}, {}) // named slots
h('div', {}, 'foo') // text

// named slots without props requires explicit `null` to avoid ambiguity
h('div', null, {})
**/

interface Props {
  [key: string]: any
  key?: string | number
  ref?: string | Ref<any> | Function
  // used to differ from a single VNode object as children
  _isVNode?: never
  // used to differ from Array children
  [Symbol.iterator]?: never
}

type Children = string | number | VNodeChildren

// fake constructor type returned from `createComponent`
interface Constructor<P = any> {
  new (): { $props: P }
}

// The following is a series of overloads for providing props validation of
// manually written render functions.

// element
export function h(type: string, children?: Children): VNode
export function h(
  type: string,
  props?: Props | null,
  children?: Children
): VNode

// keyed fragment
export function h(type: typeof Fragment, children?: Children): VNode
export function h(
  type: typeof Fragment,
  props?: (Props & { key?: string | number }) | null,
  children?: Children
): VNode

// portal
export function h(type: typeof Portal, children?: Children): VNode
export function h(
  type: typeof Portal,
  props?: (Props & { target: any }) | null,
  children?: Children
): VNode

// functional component
export function h(type: FunctionalComponent, children?: Children): VNode
export function h<P>(
  type: FunctionalComponent<P>,
  props?: (Props & P) | null,
  children?: Children | RawSlots
): VNode

// stateful component
export function h(type: ComponentOptions, children?: Children): VNode
export function h<P>(
  type: ComponentOptionsWithoutProps<P>,
  props?: (Props & P) | null,
  children?: Children | RawSlots
): VNode
export function h<P extends string>(
  type: ComponentOptionsWithArrayProps<P>,
  // TODO for now this doesn't really do anything, but it would become useful
  // if we make props required by default
  props?: (Props & { [key in P]?: any }) | null,
  children?: Children | RawSlots
): VNode
export function h<P>(
  type: ComponentOptionsWithProps<P>,
  props?: (Props & ExtractPropTypes<P>) | null,
  children?: Children | RawSlots
): VNode

// fake constructor type returned by `createComponent`
export function h(type: Constructor, children?: Children): VNode
export function h<P>(
  type: Constructor<P>,
  props?: (Props & P) | null,
  children?: Children | RawSlots
): VNode

// Actual implementation
export function h(
  type: VNodeTypes,
  propsOrChildren?: any,
  children?: any
): VNode {
  if (arguments.length === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // props without children
      return createVNode(type, propsOrChildren)
    } else {
      // omit props
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    return createVNode(type, propsOrChildren, children)
  }
}
