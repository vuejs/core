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
  type: VNodeTypes
  props: { [key: string]: any } | null
  key: string | number | null
  children: string | VNodeChildren | null
  patchFlag: number | null
  dynamicProps: string[] | null
  dynamicChildren: VNode[] | null
}

const blockStack: (VNode[])[] = []

// open block
export function openBlock() {
  blockStack.push([])
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
  vnode.dynamicChildren = blockStack.pop() || null
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
    el: null,
    type,
    props,
    key: props && props.key,
    children,
    patchFlag,
    dynamicProps,
    dynamicChildren: null
  }
  if (patchFlag != null && shouldTrack) {
    trackDynamicNode(vnode)
  }
  return vnode
}

function trackDynamicNode(vnode: VNode) {
  const currentBlockDynamicNodes = blockStack[blockStack.length - 1]
  if (currentBlockDynamicNodes) {
    currentBlockDynamicNodes.push(vnode)
  }
}

export function cloneVNode(vnode: VNode): VNode {
  // TODO
  return vnode
}
