import {
  VNode,
  VNodeProps,
  createVNode,
  VNodeArrayChildren,
  Fragment,
  isVNode
} from './vnode'
import { Portal, PortalProps } from './components/Portal'
import { Suspense, SuspenseProps } from './components/Suspense'
import { isObject, isArray } from '@vue/shared'
import { RawSlots } from './componentSlots'
import { FunctionalComponent } from './component'
import {
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps,
  ComponentOptions
} from './apiOptions'
import { ExtractPropTypes } from './componentProps'
import { currentRenderingInstance } from './componentRenderUtils'

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
  _isVNode?: never
  // used to differ from Array children
  [Symbol.iterator]?: never
}

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
  __isPortal?: never
  __isSuspense?: never
  new (): { $props: P }
}

// The following is a series of overloads for providing props validation of
// manually written render functions.

// element
function _h(type: string, children?: RawChildren): VNode
function _h(
  type: string,
  props?: RawProps | null,
  children?: RawChildren
): VNode

// fragment
function _h(type: typeof Fragment, children?: VNodeArrayChildren): VNode
function _h(
  type: typeof Fragment,
  props?: RawProps | null,
  children?: VNodeArrayChildren
): VNode

// portal (target prop is required)
function _h(
  type: typeof Portal,
  props: RawProps & PortalProps,
  children: RawChildren
): VNode

// suspense
function _h(type: typeof Suspense, children?: RawChildren): VNode
function _h(
  type: typeof Suspense,
  props?: (RawProps & SuspenseProps) | null,
  children?: RawChildren | RawSlots
): VNode

// functional component
function _h(type: FunctionalComponent, children?: RawChildren): VNode
function _h<P>(
  type: FunctionalComponent<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// stateful component
function _h(type: ComponentOptions, children?: RawChildren): VNode
function _h(
  type: ComponentOptionsWithoutProps | ComponentOptionsWithArrayProps,
  props?: RawProps | null,
  children?: RawChildren | RawSlots
): VNode
function _h<O>(
  type: ComponentOptionsWithObjectProps<O>,
  props?:
    | (RawProps & ExtractPropTypes<O>)
    | ({} extends ExtractPropTypes<O> ? null : never),
  children?: RawChildren | RawSlots
): VNode

// fake constructor type returned by `defineComponent` or class component
function _h(type: Constructor, children?: RawChildren): VNode
function _h<P>(
  type: Constructor<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// Actual implementation
function _h(type: any, propsOrChildren?: any, children?: any): VNode {
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

export const h: typeof _h = __DEV__ ? (applyTransformedH as typeof _h) : _h

let argsTransformer: Function | undefined

// This is used to hook into the h function and transform its arguments
// Useful for re-implementing behavior that was previously done with createElement in Vue 2
function applyTransformedH(...args: unknown[]): VNode {
  if (argsTransformer) {
    args = argsTransformer(args, currentRenderingInstance)
  }
  return _h(...(args as Parameters<typeof _h>))
}

export function transformHArgs(transformer: Function): void {
  argsTransformer = transformer
}

export function resetTransformHArgs(): void {
  argsTransformer = undefined
}
