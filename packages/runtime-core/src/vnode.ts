import {
  isArray,
  isFunction,
  isString,
  isObject,
  EMPTY_ARR,
  extend
} from '@vue/shared'
import {
  ComponentInternalInstance,
  Data,
  SetupProxySymbol,
  Component
} from './component'
import { RawSlots } from './componentSlots'
import { ShapeFlags } from './shapeFlags'
import { isReactive, Ref } from '@vue/reactivity'
import { AppContext } from './apiApp'
import { SuspenseBoundary } from './components/Suspense'
import { DirectiveBinding } from './directives'
import { SuspenseImpl } from './components/Suspense'

export const Fragment = (Symbol(__DEV__ ? 'Fragment' : undefined) as any) as {
  __isFragment: true
  new (): {
    $props: VNodeProps
  }
}
export const Portal = (Symbol(__DEV__ ? 'Portal' : undefined) as any) as {
  __isPortal: true
  new (): {
    $props: VNodeProps & { target: string | object }
  }
}
export const Text = Symbol(__DEV__ ? 'Text' : undefined)
export const Comment = Symbol(__DEV__ ? 'Comment' : undefined)

export type VNodeTypes =
  | string
  | Component
  | typeof Fragment
  | typeof Portal
  | typeof Text
  | typeof Comment
  | typeof SuspenseImpl

export interface VNodeProps {
  [key: string]: any
  key?: string | number
  ref?: string | Ref | ((ref: object | null) => void)
}

type VNodeChildAtom<HostNode, HostElement> =
  | VNode<HostNode, HostElement>
  | string
  | number
  | boolean
  | null
  | void

export interface VNodeChildren<HostNode = any, HostElement = any>
  extends Array<
      | VNodeChildren<HostNode, HostElement>
      | VNodeChildAtom<HostNode, HostElement>
    > {}

export type VNodeChild<HostNode = any, HostElement = any> =
  | VNodeChildAtom<HostNode, HostElement>
  | VNodeChildren<HostNode, HostElement>

export type NormalizedChildren<HostNode = any, HostElement = any> =
  | string
  | VNodeChildren<HostNode, HostElement>
  | RawSlots
  | null

export interface VNode<HostNode = any, HostElement = any> {
  _isVNode: true
  type: VNodeTypes
  props: VNodeProps | null
  key: string | number | null
  ref: string | Function | null
  children: NormalizedChildren<HostNode, HostElement>
  component: ComponentInternalInstance | null
  suspense: SuspenseBoundary<HostNode, HostElement> | null
  dirs: DirectiveBinding[] | null

  // DOM
  el: HostNode | null
  anchor: HostNode | null // fragment anchor
  target: HostElement | null // portal target

  // optimization only
  shapeFlag: number
  patchFlag: number
  dynamicProps: string[] | null
  dynamicChildren: VNode[] | null

  // application root node only
  appContext: AppContext | null
}

// Since v-if and v-for are the two possible ways node structure can dynamically
// change, once we consider v-if branches and each v-for fragment a block, we
// can divide a template into nested blocks, and within each block the node
// structure would be stable. This allows us to skip most children diffing
// and only worry about the dynamic nodes (indicated by patch flags).
const blockStack: (VNode[] | null)[] = []
let currentBlock: VNode[] | null = null

// Open a block.
// This must be called before `createBlock`. It cannot be part of `createBlock`
// because the children of the block are evaluated before `createBlock` itself
// is called. The generated code typically looks like this:
//
//   function render() {
//     return (openBlock(),createBlock('div', null, [...]))
//   }
//
// disableTracking is true when creating a fragment block, since a fragment
// always diffs its children.
export function openBlock(disableTracking?: boolean) {
  blockStack.push((currentBlock = disableTracking ? null : []))
}

// Whether we should be tracking dynamic child nodes inside a block.
// Only tracks when this value is > 0
// We are not using a simple boolean because this value may need to be
// incremented/decremented by nested usage of v-once (see below)
let shouldTrack = 1

// Block tracking sometimes needs to be disabled, for example during the
// creation of a tree that needs to be cached by v-once. The compiler generates
// code like this:
//   _cache[1] || (
//     setBlockTracking(-1),
//     _cache[1] = createVNode(...),
//     setBlockTracking(1),
//     _cache[1]
//   )
export function setBlockTracking(value: number) {
  shouldTrack += value
}

// Create a block root vnode. Takes the same exact arguments as `createVNode`.
// A block root keeps track of dynamic nodes within the block in the
// `dynamicChildren` array.
export function createBlock(
  type: VNodeTypes,
  props?: { [key: string]: any } | null,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  // avoid a block with patchFlag tracking itself
  shouldTrack--
  const vnode = createVNode(type, props, children, patchFlag, dynamicProps)
  shouldTrack++
  // save current block children on the block vnode
  vnode.dynamicChildren = currentBlock || EMPTY_ARR
  // close block
  blockStack.pop()
  currentBlock = blockStack[blockStack.length - 1] || null
  // a block is always going to be patched, so track it as a child of its
  // parent block
  if (currentBlock !== null) {
    currentBlock.push(vnode)
  }
  return vnode
}

export function isVNode(value: any): value is VNode {
  return value ? value._isVNode === true : false
}

export function createVNode(
  type: VNodeTypes,
  props: { [key: string]: any } | null = null,
  children: unknown = null,
  patchFlag: number = 0,
  dynamicProps: string[] | null = null
): VNode {
  // class & style normalization.
  if (props !== null) {
    // for reactive or proxy objects, we need to clone it to enable mutation.
    if (isReactive(props) || SetupProxySymbol in props) {
      props = extend({}, props)
    }
    let { class: klass, style } = props
    if (klass != null && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    if (style != null) {
      // reactive state objects need to be cloned since they are likely to be
      // mutated
      if (isReactive(style) && !isArray(style)) {
        style = extend({}, style)
      }
      props.style = normalizeStyle(style)
    }
  }

  // encode the vnode type information into a bitmap
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && (type as any).__isSuspense === true
      ? ShapeFlags.SUSPENSE
      : isObject(type)
        ? ShapeFlags.STATEFUL_COMPONENT
        : isFunction(type)
          ? ShapeFlags.FUNCTIONAL_COMPONENT
          : 0

  const vnode: VNode = {
    _isVNode: true,
    type,
    props,
    key: (props !== null && props.key) || null,
    ref: (props !== null && props.ref) || null,
    children: null,
    component: null,
    suspense: null,
    dirs: null,
    el: null,
    anchor: null,
    target: null,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null
  }

  normalizeChildren(vnode, children)

  // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  if (
    shouldTrack > 0 &&
    currentBlock !== null &&
    (patchFlag > 0 ||
      shapeFlag & ShapeFlags.STATEFUL_COMPONENT ||
      shapeFlag & ShapeFlags.FUNCTIONAL_COMPONENT)
  ) {
    currentBlock.push(vnode)
  }

  return vnode
}

export function cloneVNode<T, U>(
  vnode: VNode<T, U>,
  extraProps?: Data
): VNode<T, U> {
  // This is intentionally NOT using spread or extend to avoid the runtime
  // key enumeration cost.
  return {
    _isVNode: true,
    type: vnode.type,
    props: extraProps
      ? vnode.props
        ? mergeProps(vnode.props, extraProps)
        : extraProps
      : vnode.props,
    key: vnode.key,
    ref: vnode.ref,
    children: vnode.children,
    target: vnode.target,
    shapeFlag: vnode.shapeFlag,
    patchFlag: vnode.patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,

    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: vnode.component,
    suspense: vnode.suspense,
    el: vnode.el,
    anchor: vnode.anchor
  }
}

export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  return createVNode(Text, null, text, flag)
}

export function createCommentVNode(
  text: string = '',
  // when used as the v-else branch, the comment node must be created as a
  // block to ensure correct updates.
  asBlock: boolean = false
): VNode {
  return asBlock
    ? createBlock(Comment, null, text)
    : createVNode(Comment, null, text)
}

export function normalizeVNode<T, U>(child: VNodeChild<T, U>): VNode<T, U> {
  if (child == null) {
    // empty placeholder
    return createVNode(Comment)
  } else if (isArray(child)) {
    // fragment
    return createVNode(Fragment, null, child)
  } else if (typeof child === 'object') {
    // already vnode, this should be the most common since compiled templates
    // always produce all-vnode children arrays
    return child.el === null ? child : cloneVNode(child)
  } else {
    // primitive types
    return createVNode(Text, null, child + '')
  }
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
    type = ShapeFlags.SLOTS_CHILDREN
  } else if (isFunction(children)) {
    children = { default: children }
    type = ShapeFlags.SLOTS_CHILDREN
  } else {
    children = isString(children) ? children : children + ''
    type = ShapeFlags.TEXT_CHILDREN
  }
  vnode.children = children as NormalizedChildren
  vnode.shapeFlag |= type
}

function normalizeStyle(
  value: unknown
): Record<string, string | number> | void {
  if (isArray(value)) {
    const res: Record<string, string | number> = {}
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeStyle(value[i])
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (isObject(value)) {
    return value
  }
}

export function normalizeClass(value: unknown): string {
  let res = ''
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      res += normalizeClass(value[i]) + ' '
    }
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}

const handlersRE = /^on|^vnode/

export function mergeProps(...args: Data[]) {
  const ret: Data = {}
  extend(ret, args[0])
  for (let i = 1; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key === 'class') {
        ret.class = normalizeClass([ret.class, toMerge.class])
      } else if (key === 'style') {
        ret.style = normalizeStyle([ret.style, toMerge.style])
      } else if (handlersRE.test(key)) {
        // on*, vnode*
        const existing = ret[key]
        ret[key] = existing
          ? [].concat(existing as any, toMerge[key] as any)
          : toMerge[key]
      } else {
        ret[key] = toMerge[key]
      }
    }
  }
  return ret
}
