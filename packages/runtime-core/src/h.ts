import {
  VNodeTypes,
  VNode,
  createVNode,
  VNodeChildren,
  Fragment,
  Portal,
  isVNode,
  Suspense
} from './vnode'
import { isObject, isArray } from '@vue/shared'
import { Ref } from '@vue/reactivity'
import { RawSlots } from './componentSlots'
import { FunctionalComponent } from './component'
import {
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps,
  ComponentOptions
} from './apiOptions'
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
h('div', 'foo') // text
h('div', h('br')) // vnode
h(Component, () => {}) // default slot

// type + props + children
h('div', {}, []) // array
h('div', {}, 'foo') // text
h('div', {}, h('br')) // vnode
h(Component, {}, () => {}) // default slot
h(Component, {}, {}) // named slots

// named slots without props requires explicit `null` to avoid ambiguity
h(Component, null, {})
**/

export interface RawProps {
  [key: string]: any
  key?: string | number
  ref?: string | Ref | Function
  // used to differ from a single VNode object as children
  _isVNode?: never
  // used to differ from Array children
  [Symbol.iterator]?: never
}

export type RawChildren<N = any, E = any> =
  | string
  | number
  | boolean
  | VNode<N, E>
  | VNodeChildren<N, E>
  | (() => any)

export { RawSlots }

// fake constructor type returned from `createComponent`
interface Constructor<P = any> {
  new (): { $props: P }
}

// The following is a series of overloads for providing props validation of
// manually written render functions.

// element
export function h<N, E>(type: string, children?: RawChildren<N, E>): VNode<N, E>
export function h<N, E>(
  type: string,
  props?: RawProps | null,
  children?: RawChildren<N, E>
): VNode<N, E>

// keyed fragment
export function h<N, E>(
  type: typeof Fragment,
  children?: RawChildren<N, E>
): VNode<N, E>
export function h<N, E>(
  type: typeof Fragment,
  props?: (RawProps & { key?: string | number }) | null,
  children?: RawChildren<N, E>
): VNode<N, E>

// portal
// Portal without props (target) will create a runtime error
export function h<N, E>(
  type: typeof Portal,
  props?: (RawProps & { target: string | E }) | null,
  children?: RawChildren<N, E>
): VNode<N, E>

// suspense
export function h<N, E>(
  type: typeof Suspense,
  children?: RawChildren<N, E>
): VNode<N, E>
export function h<N, E>(
  type: typeof Suspense,
  props?:
    | (RawProps & {
        onResolve?: () => void
        onRecede?: () => void
      })
    | null,
  children?: RawChildren<N, E> | RawSlots
): VNode<N, E>

// functional component
export function h<N, E>(
  type: FunctionalComponent,
  children?: RawChildren<N, E>
): VNode<N, E>
export function h<P, N, E>(
  type: FunctionalComponent<P>,
  props?: (RawProps & P) | null,
  children?: RawChildren<N, E> | RawSlots
): VNode<N, E>

// stateful component
export function h<N, E>(
  type: ComponentOptions,
  children?: RawChildren<N, E>
): VNode<N, E>
export function h<P, N, E>(
  type: ComponentOptionsWithoutProps<P>,
  props?: (RawProps & P) | null,
  children?: RawChildren<N, E> | RawSlots
): VNode<N, E>
export function h<P extends string, N, E>(
  type: ComponentOptionsWithArrayProps<P>,
  // TODO for now this doesn't really do anything, but it would become useful
  // if we make props required by default
  props?: (RawProps & { [key in P]?: any }) | null,
  children?: RawChildren<N, E> | RawSlots
): VNode<N, E>
export function h<P, N, E>(
  type: ComponentOptionsWithObjectProps<P>,
  props?: (RawProps & ExtractPropTypes<P>) | null,
  children?: RawChildren<N, E> | RawSlots
): VNode<N, E>

// fake constructor type returned by `createComponent`
export function h<N, E>(
  type: Constructor,
  children?: RawChildren<N, E>
): VNode<N, E>
export function h<P, N, E>(
  type: Constructor<P>,
  props?: (RawProps & P) | null,
  children?: RawChildren<N, E> | RawSlots
): VNode<N, E>

// Actual implementation
export function h(
  type: VNodeTypes,
  propsOrChildren?: any,
  children?: any
): VNode {
  if (arguments.length === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // single vnode without props
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren])
      }
      // props without children
      return createVNode(type, propsOrChildren)
    } else {
      // omit props
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if (isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
