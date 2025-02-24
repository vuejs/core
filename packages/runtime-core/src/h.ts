import { type IfAny, isArray, isObject } from '@vue/shared'
import type { Component, FunctionalComponent } from './component'
import type { EmitsOptions } from './componentEmits'
import type {
  ComponentObjectPropsOptions,
  ExtractPublicPropTypes,
} from './componentProps'
import type { Suspense, SuspenseProps } from './components/Suspense'
import type { Teleport, TeleportProps } from './components/Teleport'
import type { RawSlots } from './componentSlots'
import {
  type Comment,
  type Fragment,
  type Text,
  type VNode,
  type VNodeArrayChildren,
  type VNodeProps,
  createVNode,
  isVNode,
} from './vnode'

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

type RawProps = VNodeProps & {
  // used to differ from a single VNode object as children
  __v_isVNode?: never
  // used to differ from Array children
  [Symbol.iterator]?: never
} & Record<string, any>

type RawChildren =
  | string
  | number
  | boolean
  | VNode
  | VNodeArrayChildren
  | (() => any)

// fake constructor type returned from `defineComponent`
interface Constructor<P = any> {
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never
  new (...args: any[]): { $props: P }
}

type HTMLElementEventHandler = {
  [K in keyof HTMLElementEventMap as `on${Capitalize<K>}`]?: (
    ev: HTMLElementEventMap[K],
  ) => any
}

// The following is a series of overloads for providing props validation of
// manually written render functions.

// element
export function h(
  type: keyof HTMLElementTagNameMap,
  children?: RawChildren,
): VNode
export function h(
  type: keyof HTMLElementTagNameMap,
  props?: (RawProps & HTMLElementEventHandler) | null,
  children?: RawChildren | RawSlots,
): VNode

// custom element
export function h(type: string, children?: RawChildren): VNode
export function h(
  type: string,
  props?: RawProps | null,
  children?: RawChildren | RawSlots,
): VNode

// text/comment
export function h(
  type: typeof Text | typeof Comment,
  children?: string | number | boolean,
): VNode
export function h(
  type: typeof Text | typeof Comment,
  props?: null,
  children?: string | number | boolean,
): VNode
// fragment
export function h(type: typeof Fragment, children?: VNodeArrayChildren): VNode
export function h(
  type: typeof Fragment,
  props?: RawProps | null,
  children?: VNodeArrayChildren,
): VNode

// teleport (target prop is required)
export function h(
  type: typeof Teleport,
  props: RawProps & TeleportProps,
  children: RawChildren | RawSlots,
): VNode

// suspense
export function h(type: typeof Suspense, children?: RawChildren): VNode
export function h(
  type: typeof Suspense,
  props?: (RawProps & SuspenseProps) | null,
  children?: RawChildren | RawSlots,
): VNode

// functional component
export function h<
  P,
  E extends EmitsOptions = {},
  S extends Record<string, any> = any,
>(
  type: FunctionalComponent<P, any, S, any>,
  props?: NoInfer<(RawProps & P) | ({} extends P ? null : never)>,
  children?: NoInfer<RawChildren | IfAny<S, RawSlots, S>>,
): VNode

// catch-all for generic component types
export function h(type: Component, children?: RawChildren): VNode

// fake constructor type returned by `defineComponent` or class component
export function h(type: Constructor, children?: RawChildren): VNode
export function h<P>(
  type: Constructor<P>,
  props?: NoInfer<(RawProps & P) | ({} extends P ? null : never)>,
  children?: RawChildren | RawSlots,
): VNode

// export function h(type: { props: any }, children?: RawChildren): VNode
export function h<
  P extends string,
  PP = ExtractPublicPropTypes<{ [K in P]: null }>,
>(
  type: { props: P[] },
  props?: NoInfer<(RawProps & PP) | ({} extends PP ? null : never)>,
  children?: RawChildren | RawSlots,
): VNode
export function h<
  P extends ComponentObjectPropsOptions,
  PP = ExtractPublicPropTypes<P>,
>(
  type: { props: P },
  props?: NoInfer<(RawProps & PP) | ({} extends PP ? null : never)>,
  children?: RawChildren | RawSlots,
): VNode

// catch all types
export function h(type: string | Component, children?: RawChildren): VNode
export function h<P>(
  type: string | Component<P>,
  props?: NoInfer<(RawProps & P) | ({} extends P ? null : never)>,
  children?: RawChildren | RawSlots,
): VNode

// Actual implementation
export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  const l = arguments.length
  if (l === 2) {
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
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
