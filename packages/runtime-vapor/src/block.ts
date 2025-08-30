import { isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { createComment, createTextNode } from './dom/node'
import { EffectScope, setActiveSub } from '@vue/reactivity'
import {
  CommentDraft,
  NodeDraft,
  NodeRef,
  type VaporNode,
  type VaporParentNode,
  toNode,
} from './dom/nodeDraft'

export type Block =
  | VaporNode
  | VaporFragment
  | DynamicFragment
  | VaporComponentInstance
  | Block[]

export type BlockFn = (...args: any[]) => Block

export class VaporFragment {
  nodes: Block
  anchor?: VaporNode
  insert?: (parent: VaporParentNode, anchor: VaporNode | null) => void
  remove?: (parent?: VaporParentNode) => void

  constructor(nodes: Block) {
    this.nodes = nodes
  }
}

export class DynamicFragment extends VaporFragment {
  anchor: VaporNode
  scope: EffectScope | undefined
  current?: BlockFn
  fallback?: BlockFn

  constructor(anchorLabel?: string) {
    super([])
    this.anchor =
      __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
      return
    }
    this.current = key

    const prevSub = setActiveSub()
    const parent = toNode(this.anchor).parentNode

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

    setActiveSub(prevSub)
  }
}

export function isFragment(val: NonNullable<unknown>): val is VaporFragment {
  return val instanceof VaporFragment
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
  } else if (block instanceof NodeRef) {
    return !(block instanceof CommentDraft)
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
  parent: VaporParentNode,
  anchor: VaporNode | null | 0 = null, // 0 means prepend
): void {
  const _parent = toNode(parent)
  const blockOrDraft = toNode(block)

  anchor = anchor === 0 ? _parent.$anchor || _parent.firstChild : anchor
  if (blockOrDraft instanceof Node) {
    ;(_parent as Node).insertBefore(blockOrDraft, anchor as Node)
  } else if (blockOrDraft instanceof NodeDraft) {
    // Hydration
    if (!(_parent instanceof Node)) {
      const index = anchor ? _parent.childNodes.indexOf(anchor as NodeRef) : -1
      if (index === -1) {
        _parent.childNodes.push(block as NodeRef<false>)
      } else {
        _parent.childNodes.splice(index, 0, block as NodeRef<false>)
      }
    } else if (__DEV__) {
      throw new Error(
        'Cannot insert a NodeDraft to a real ParentNode. Did you forget to resolve it?',
      )
    }
  } else if (isVaporComponent(blockOrDraft)) {
    if (blockOrDraft.isMounted) {
      insert(blockOrDraft.block!, parent, anchor)
    } else {
      mountComponent(blockOrDraft, parent, anchor)
    }
  } else if (isArray(blockOrDraft)) {
    for (const b of blockOrDraft) {
      insert(b, parent, anchor)
    }
  } else {
    // fragment
    if (blockOrDraft.insert) {
      blockOrDraft.insert(parent, anchor)
    } else {
      insert(blockOrDraft.nodes, parent, anchor)
    }
    if (blockOrDraft.anchor) insert(blockOrDraft.anchor, parent, anchor)
  }
}

export type InsertFn = typeof insert

export function prepend(parent: VaporParentNode, ...blocks: Block[]): void {
  let i = blocks.length
  while (i--) insert(blocks[i], parent, 0)
}

export function remove(block: Block, parent?: VaporParentNode): void {
  const _parent = toNode(parent)
  const blockOrDraft = toNode(block)

  if (blockOrDraft instanceof Node) {
    _parent && (_parent as Node).removeChild(blockOrDraft)
  } else if (blockOrDraft instanceof NodeDraft) {
    // Hydration
    if (_parent && !(_parent instanceof Node)) {
      const index = _parent.childNodes.indexOf(block as NodeRef)
      if (index > -1) {
        _parent.childNodes.splice(index, 1)
      }
    } else if (__DEV__) {
      throw new Error(
        'Cannot remove a NodeDraft from a real ParentNode. Did you forget to resolve it?',
      )
    }
  } else if (isVaporComponent(blockOrDraft)) {
    unmountComponent(blockOrDraft, parent)
  } else if (isArray(blockOrDraft)) {
    for (let i = 0; i < blockOrDraft.length; i++) {
      remove(blockOrDraft[i], parent)
    }
  } else {
    // fragment
    if (blockOrDraft.remove) {
      blockOrDraft.remove(parent)
    } else {
      remove(blockOrDraft.nodes, parent)
    }
    if (blockOrDraft.anchor) remove(blockOrDraft.anchor, parent)
    if ((blockOrDraft as DynamicFragment).scope) {
      ;(blockOrDraft as DynamicFragment).scope!.stop()
    }
  }
}

/**
 * dev / test only
 */
export function normalizeBlock(block: Block): VaporNode[] {
  if (!__DEV__ && !__TEST__) {
    throw new Error(
      'normalizeBlock should not be used in production code paths',
    )
  }
  const nodes: VaporNode[] = []
  if (block instanceof Node || block instanceof NodeRef) {
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
