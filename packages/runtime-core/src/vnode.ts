import { isFunction } from '@vue/shared'

export const Fragment = Symbol('Fragment')
export const Text = Symbol('Text')
export const Empty = Symbol('Empty')

type VNodeTypes =
  | string
  | Function
  | typeof Fragment
  | typeof Text
  | typeof Empty

export type VNodeChild = VNode | string | number | null
export interface VNodeChildren extends Array<VNodeChildren | VNodeChild> {}

export interface VNode {
  el: any
  anchor: any // fragment anchor
  type: VNodeTypes
  props: { [key: string]: any } | null
  key: string | number | null
  children: string | VNodeChildren | null
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
