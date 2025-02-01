import { isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { createComment } from './dom/node'
import { EffectScope, pauseTracking, resetTracking } from '@vue/reactivity'

export type Block =
  | Node
  | Fragment
  | DynamicFragment
  | VaporComponentInstance
  | Block[]

export type BlockFn = (...args: any[]) => Block

export class Fragment {
  nodes: Block
  anchor?: Node

  constructor(nodes: Block) {
    this.nodes = nodes
  }
}

export class DynamicFragment extends Fragment {
  anchor: Node
  scope: EffectScope | undefined
  current?: BlockFn
  fallback?: BlockFn

  constructor(anchorLabel?: string) {
    super([])
    this.anchor =
      __DEV__ && anchorLabel
        ? createComment(anchorLabel)
        : document.createTextNode('')
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
      return
    }
    this.current = key

    pauseTracking()
    const parent = this.anchor.parentNode

    // teardown previous branch
    if (this.scope) {
      this.scope.stop()
      parent && remove(this.nodes, parent)
    }

    if (render) {
      this.scope = new EffectScope()
      this.nodes = this.scope.run(render) || []
      if (parent) insert(this.nodes, parent, this.anchor)
    } else {
      this.scope = undefined
      this.nodes = []
    }

    if (this.fallback && !isValidBlock(this.nodes)) {
      parent && remove(this.nodes, parent)
      this.nodes =
        (this.scope || (this.scope = new EffectScope())).run(this.fallback) ||
        []
      parent && insert(this.nodes, parent, this.anchor)
    }

    resetTracking()
  }
}

export function isFragment(val: NonNullable<unknown>): val is Fragment {
  return val instanceof Fragment
}

export function isBlock(val: NonNullable<unknown>): val is Block {
  return (
    val instanceof Node ||
    isArray(val) ||
    isVaporComponent(val) ||
    isFragment(val)
  )
}

export function isValidBlock(block: Block): boolean {
  if (block instanceof Node) {
    return !(block instanceof Comment)
  } else if (isVaporComponent(block)) {
    return isValidBlock(block.block)
  } else if (isArray(block)) {
    return block.length > 0 && block.every(isValidBlock)
  } else {
    // fragment
    return isValidBlock(block.nodes)
  }
}

export function insert(
  block: Block,
  parent: ParentNode,
  anchor: Node | null | 0 = null, // 0 means prepend
): void {
  anchor = anchor === 0 ? parent.firstChild : anchor
  if (block instanceof Node) {
    parent.insertBefore(block, anchor)
  } else if (isVaporComponent(block)) {
    mountComponent(block, parent, anchor)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      insert(block[i], parent, anchor)
    }
  } else {
    // fragment
    insert(block.nodes, parent, anchor)
    if (block.anchor) insert(block.anchor, parent, anchor)
  }
}

export function prepend(parent: ParentNode, ...blocks: Block[]): void {
  let i = blocks.length
  while (i--) insert(blocks[i], parent, 0)
}

/**
 * Optimized children removal: record all parents with unmounted children
 * during each root remove call, and update their children list by filtering
 * unmounted children
 */
export let parentsWithUnmountedChildren: Set<VaporComponentInstance> | null =
  null

export function remove(block: Block, parent: ParentNode): void {
  const isRoot = !parentsWithUnmountedChildren
  if (isRoot) {
    parentsWithUnmountedChildren = new Set()
  }
  if (block instanceof Node) {
    parent.removeChild(block)
  } else if (isVaporComponent(block)) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      remove(block[i], parent)
    }
  } else {
    // fragment
    remove(block.nodes, parent)
    if (block.anchor) remove(block.anchor, parent)
    if ((block as DynamicFragment).scope) {
      ;(block as DynamicFragment).scope!.stop()
    }
  }
  if (isRoot) {
    for (const i of parentsWithUnmountedChildren!) {
      i.children = i.children.filter(n => !n.isUnmounted)
    }
    parentsWithUnmountedChildren = null
  }
}

/**
 * dev / test only
 */
export function normalizeBlock(block: Block): Node[] {
  if (!__DEV__ && !__TEST__) {
    throw new Error(
      'normalizeBlock should not be used in production code paths',
    )
  }
  const nodes: Node[] = []
  if (block instanceof Node) {
    nodes.push(block)
  } else if (isArray(block)) {
    block.forEach(child => nodes.push(...normalizeBlock(child)))
  } else if (isVaporComponent(block)) {
    nodes.push(...normalizeBlock(block.block!))
  } else {
    nodes.push(...normalizeBlock(block.nodes))
    block.anchor && nodes.push(block.anchor)
  }
  return nodes
}
