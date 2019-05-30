import { isArray, EMPTY_ARR } from '@vue/shared'
import { ComponentInstance } from './component'
import { HostNode } from './createRenderer'

export const Fragment = Symbol('Fragment')
export const Text = Symbol('Text')
export const Empty = Symbol('Empty')
export const Portal = Symbol('Portal')

type VNodeTypes =
  | string
  | Function
  | Object
  | typeof Fragment
  | typeof Text
  | typeof Empty

type VNodeChildAtom = VNode | string | number | null | void
export interface VNodeChildren extends Array<VNodeChildren | VNodeChildAtom> {}
export type VNodeChild = VNodeChildAtom | VNodeChildren

export interface VNode {
  type: VNodeTypes
  props: { [key: string]: any } | null
  key: string | number | null
  children: string | VNodeChildren | null
  component: ComponentInstance | null

  // DOM
  el: HostNode | null
  anchor: HostNode | null // fragment anchor
  target: HostNode | null // portal target

  // optimization only
  patchFlag: number | null
  dynamicProps: string[] | null
  dynamicChildren: VNode[] | null
}

// Since v-if and v-for are the two possible ways node structure can dynamically
// change, once we consider v-if branches and each v-for fragment a block, we
// can divide a template into nested blocks, and within each block the node
// structure would be stable. This allows us to skip most children diffing
// and only worry about the dynamic nodes (indicated by patch flags).
const blockStack: (VNode[] | null)[] = []

// Open a block.
// This must be called before `createBlock`. It cannot be part of `createBlock`
// because the children of the block are evaluated before `createBlock` itself
// is called. The generated code typically looks like this:
//
//   function render() {
//     return (openBlock(),createBlock('div', null, [...]))
//   }
export function openBlock(disableTrackng?: boolean) {
  blockStack.push(disableTrackng ? null : [])
}

let shouldTrack = true

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
  // avoid a block with optFlag tracking itself
  shouldTrack = false
  const vnode = createVNode(type, props, children, patchFlag, dynamicProps)
  shouldTrack = true
  const trackedNodes = blockStack.pop()
  vnode.dynamicChildren =
    trackedNodes && trackedNodes.length ? trackedNodes : EMPTY_ARR
  // a block is always going to be patched
  trackDynamicNode(vnode)
  return vnode
}

export function createVNode(
  type: VNodeTypes,
  props: { [key: string]: any } | null = null,
  children: any = null,
  patchFlag: number | null = null,
  dynamicProps: string[] | null = null
): VNode {
  const vnode: VNode = {
    type,
    props,
    key: props && props.key,
    children: typeof children === 'number' ? children + '' : children,
    component: null,
    el: null,
    anchor: null,
    target: null,
    patchFlag,
    dynamicProps,
    dynamicChildren: null
  }
  // presence of a patch flag indicates this node is dynamic
  if (shouldTrack && patchFlag != null) {
    trackDynamicNode(vnode)
  }
  return vnode
}

function trackDynamicNode(vnode: VNode) {
  const currentBlockDynamicNodes = blockStack[blockStack.length - 1]
  if (currentBlockDynamicNodes != null) {
    currentBlockDynamicNodes.push(vnode)
  }
}

export function cloneVNode(vnode: VNode): VNode {
  // TODO
  return vnode
}

export function normalizeVNode(child: VNodeChild): VNode {
  if (child == null) {
    // empty placeholder
    return createVNode(Empty)
  } else if (isArray(child)) {
    // fragment
    return createVNode(Fragment, null, child)
  } else if (typeof child === 'object') {
    // already vnode
    return child as VNode
  } else {
    // primitive types
    return createVNode(Text, null, child + '')
  }
}
