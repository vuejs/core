import { isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { createComment, createTextNode } from './dom/node'
import { EffectScope, setActiveSub } from '@vue/reactivity'
import { isHydrating } from './dom/hydration'

export type Block =
  | Node
  | VaporFragment
  | DynamicFragment
  | VaporComponentInstance
  | Block[]

export type BlockFn = (...args: any[]) => Block

export class VaporFragment<T extends Block = Block> {
  nodes: T
  anchor?: Node
  insert?: (parent: ParentNode, anchor: Node | null) => void
  remove?: (parent?: ParentNode) => void
  fallback?: BlockFn

  constructor(nodes: T) {
    this.nodes = nodes
  }
}

export class ForFragment extends VaporFragment<Block[]> {
  constructor(nodes: Block[]) {
    super(nodes)
  }
}

export class DynamicFragment extends VaporFragment {
  anchor: Node
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

    if (this.fallback) {
      // set fallback for nested fragments
      const hasNestedFragment = isFragment(this.nodes)
      if (hasNestedFragment) {
        setFragmentFallback(this.nodes as VaporFragment, this.fallback)
      }

      const invalidFragment = findInvalidFragment(this)
      if (invalidFragment) {
        parent && remove(this.nodes, parent)
        const scope = this.scope || (this.scope = new EffectScope())
        scope.run(() => {
          // for nested fragments, render invalid fragment's fallback
          if (hasNestedFragment) {
            renderFragmentFallback(invalidFragment)
          } else {
            this.nodes = this.fallback!() || []
          }
        })
        parent && insert(this.nodes, parent, this.anchor)
      }
    }

    setActiveSub(prevSub)
  }
}

export function setFragmentFallback(
  fragment: VaporFragment,
  fallback: BlockFn,
): void {
  if (fragment.fallback) {
    const originalFallback = fragment.fallback
    // if the original fallback also renders invalid blocks,
    // this ensures proper fallback chaining
    fragment.fallback = () => {
      const fallbackNodes = originalFallback()
      if (isValidBlock(fallbackNodes)) {
        return fallbackNodes
      }
      return fallback()
    }
  } else {
    fragment.fallback = fallback
  }

  if (isFragment(fragment.nodes)) {
    setFragmentFallback(fragment.nodes, fragment.fallback)
  }
}

function renderFragmentFallback(fragment: VaporFragment): void {
  if (fragment instanceof ForFragment) {
    fragment.nodes[0] = [fragment.fallback!() || []] as Block[]
  } else if (fragment instanceof DynamicFragment) {
    fragment.update(fragment.fallback)
  } else {
    // vdom slots
  }
}

function findInvalidFragment(fragment: VaporFragment): VaporFragment | null {
  if (isValidBlock(fragment.nodes)) return null

  return isFragment(fragment.nodes)
    ? findInvalidFragment(fragment.nodes) || fragment
    : fragment
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
  anchor = anchor === 0 ? parent.firstChild : anchor
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
      // TODO handle hydration for vdom interop
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
