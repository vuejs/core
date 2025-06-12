import { isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  currentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { createComment, createTextNode } from './dom/node'
import { EffectScope, pauseTracking, resetTracking } from '@vue/reactivity'
import {
  currentHydrationNode,
  isComment,
  isHydrating,
  locateHydrationNode,
  locateVaporFragmentAnchor,
} from './dom/hydration'
import { queuePostFlushCb } from '@vue/runtime-dom'

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
  fallback?: BlockFn

  constructor(nodes: Block) {
    this.nodes = nodes
  }
}

export class DynamicFragment extends VaporFragment {
  anchor!: Node
  scope: EffectScope | undefined
  current?: BlockFn

  constructor(anchorLabel?: string) {
    super([])
    if (isHydrating) {
      locateHydrationNode(true)
      this.hydrate(anchorLabel!)
    } else {
      this.anchor =
        __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
    }
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

  hydrate(label: string): void {
    // for `v-if="false"` the node will be an empty comment, use it as the anchor.
    // otherwise, find next sibling vapor fragment anchor
    if (isComment(currentHydrationNode!, '')) {
      this.anchor = currentHydrationNode
    } else {
      const anchor = locateVaporFragmentAnchor(currentHydrationNode!, label)!
      if (anchor) {
        this.anchor = anchor
      } else if (__DEV__) {
        // this should not happen
        throw new Error(`${label} fragment anchor node was not found.`)
      }
    }
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

export function setScopeId(block: Block, scopeId?: string): void {
  if (block instanceof Node) {
    if (scopeId && block instanceof Element) {
      block.setAttribute(scopeId, '')
    }
  } else if (isVaporComponent(block)) {
    setComponentScopeId(block, scopeId, true)
  } else if (isArray(block)) {
    for (const b of block) {
      setScopeId(b, scopeId)
    }
  } else {
    setScopeId(block.nodes, scopeId)
  }
}

export function setComponentScopeId(
  instance: VaporComponentInstance,
  scopeId: string | undefined = currentInstance
    ? currentInstance.type.__scopeId
    : undefined,
  immediate: boolean = false,
): void {
  function doSet() {
    if (scopeId) {
      setScopeId(instance.block, scopeId)
    }
    // inherit scopeId from parent component. this requires initial rendering
    // to be finished, due to `parent.block` is null during initial rendering
    const parent = instance.parent
    if (parent && parent.type.__scopeId) {
      // vapor parent
      if (
        parent.vapor &&
        (parent as VaporComponentInstance).block === instance
      ) {
        setScopeId(instance.block, parent.type.__scopeId)
      }
      // vdom parent
      else if (
        parent.subTree &&
        (parent.subTree.component as any) === instance
      ) {
        setScopeId(instance.block, parent.vnode!.scopeId!)
      }
    }
  }
  if (immediate) {
    doSet()
  } else {
    queuePostFlushCb(doSet)
  }
}
