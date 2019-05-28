import { isArray, isFunction } from '@vue/shared'
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

  // optimization only
  patchFlag: number | null
  dynamicProps: string[] | null
  dynamicChildren: VNode[] | null
}

const blockStack: (VNode[] | null)[] = []

// open block
export function openBlock(disableTrackng?: boolean) {
  blockStack.push(disableTrackng ? null : [])
}

let shouldTrack = true

// block
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
    trackedNodes && trackedNodes.length ? trackedNodes : null
  // a block is always going to be patched
  trackDynamicNode(vnode)
  return vnode
}

// element
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
    children,
    component: null,
    el: null,
    anchor: null,
    patchFlag,
    dynamicProps,
    dynamicChildren: null
  }
  if (shouldTrack && (patchFlag != null || isFunction(type))) {
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
