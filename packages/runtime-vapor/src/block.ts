import { isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { child, createComment, createTextNode } from './dom/node'
import { EffectScope, setActiveSub } from '@vue/reactivity'
import {
  advanceHydrationNode,
  isHydrating,
  locateFragmentEndAnchor,
  locateHydrationNode,
} from './dom/hydration'

export type Block =
  | Node
  | VaporFragment
  | DynamicFragment
  | VaporComponentInstance
  | Block[]

export type BlockFn = (...args: any[]) => Block

export class VaporFragment {
  nodes: Block
  anchor?: Node
  insert?: (parent: ParentNode, anchor: Node | null) => void
  remove?: (parent?: ParentNode) => void
  hydrate?: (...args: any[]) => any

  constructor(nodes: Block) {
    this.nodes = nodes
  }
}

export class DynamicFragment extends VaporFragment {
  anchor!: Node
  scope: EffectScope | undefined
  current?: BlockFn
  fallback?: BlockFn
  anchorLabel?: string

  constructor(anchorLabel?: string) {
    super([])
    if (isHydrating) {
      this.anchorLabel = anchorLabel
      locateHydrationNode()
    } else {
      this.anchor =
        __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
    }
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
      if (isHydrating) this.hydrate(true)
      return
    }
    this.current = key

    const prevSub = setActiveSub()
    const parent = isHydrating ? null : this.anchor.parentNode

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

    if (isHydrating) this.hydrate()
  }

  hydrate = (isEmpty = false): void => {
    // avoid repeated hydration during rendering fallback
    if (this.anchor) return

    // reuse the empty comment node as the anchor for empty if
    if (this.anchorLabel === 'if' && isEmpty) {
      this.anchor = locateFragmentEndAnchor('')!
      if (!this.anchor) {
        throw new Error('Failed to locate if anchor')
      } else {
        ;(this.anchor as Comment).data = this.anchorLabel
        return
      }
    }

    // reuse the vdom fragment end anchor for slots
    if (this.anchorLabel === 'slot') {
      this.anchor = locateFragmentEndAnchor()!
      if (!this.anchor) {
        throw new Error('Failed to locate slot anchor')
      } else {
        return
      }
    }

    // create an anchor
    const { parentNode, nextSibling } = findLastChild(this)!
    parentNode!.insertBefore(
      (this.anchor = createComment(this.anchorLabel!)),
      nextSibling,
    )
    advanceHydrationNode(this.anchor)
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
  } else if (isVaporComponent(block)) {
    return isValidBlock(block.block)
  } else if (isArray(block)) {
    return block.length > 0 && block.some(isValidBlock)
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
  anchor = anchor === 0 ? child(parent) : anchor
  if (block instanceof Node) {
    if (!isHydrating) {
      parent.insertBefore(block, anchor)
    }
  } else if (isVaporComponent(block)) {
    if (block.isMounted) {
      insert(block.block!, parent, anchor)
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (const b of block) {
      insert(b, parent, anchor)
    }
  } else {
    // fragment
    if (block.insert) {
      block.insert(parent, anchor)
    } else {
      insert(block.nodes, parent, anchor)
    }
    if (block.anchor) insert(block.anchor, parent, anchor)
  }
}

export type InsertFn = typeof insert

export function prepend(parent: ParentNode, ...blocks: Block[]): void {
  let i = blocks.length
  while (i--) insert(blocks[i], parent, 0)
}

export function remove(block: Block, parent?: ParentNode): void {
  if (block instanceof Node) {
    parent && parent.removeChild(block)
  } else if (isVaporComponent(block)) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      remove(block[i], parent)
    }
  } else {
    // fragment
    if (block.remove) {
      block.remove(parent)
    } else {
      remove(block.nodes, parent)
    }
    if (block.anchor) remove(block.anchor, parent)
    if ((block as DynamicFragment).scope) {
      ;(block as DynamicFragment).scope!.stop()
    }
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

export function findLastChild(node: Block): Node | undefined | null {
  if (node && node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return findLastChild(node[node.length - 1])
  } else if (isVaporComponent(node)) {
    return findLastChild(node.block!)
  } else {
    if (node instanceof DynamicFragment && node.anchor) return node.anchor
    return findLastChild(node.nodes!)
  }
}
