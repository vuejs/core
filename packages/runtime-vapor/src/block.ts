import { isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { _child } from './dom/node'
import { isComment, isHydrating } from './dom/hydration'
import {
  type TransitionHooks,
  type TransitionProps,
  type TransitionState,
  getInheritedScopeIds,
  performTransitionEnter,
  performTransitionLeave,
} from '@vue/runtime-dom'
import {
  type DynamicFragment,
  type VaporFragment,
  isFragment,
} from './fragment'
import { TeleportFragment } from './components/Teleport'

export interface VaporTransitionHooks extends TransitionHooks {
  state: TransitionState
  props: TransitionProps
  instance: VaporComponentInstance
  // mark transition hooks as disabled so that it skips during
  // inserting
  disabled?: boolean
}

export interface TransitionOptions {
  $key?: any
  $transition?: VaporTransitionHooks
}

export type TransitionBlock = (
  | Node
  | VaporFragment
  | DynamicFragment
  | VaporComponentInstance
) &
  TransitionOptions

export type Block =
  | Node
  | VaporFragment
  | DynamicFragment
  | VaporComponentInstance
  | Block[]
export type BlockFn = (...args: any[]) => Block

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
  parent: ParentNode & { $fc?: Node | null },
  anchor: Node | null | 0 = null, // 0 means prepend
  parentSuspense?: any, // TODO Suspense
): void {
  anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
  if (block instanceof Node) {
    if (!isHydrating) {
      // only apply transition on Element nodes
      if (
        block instanceof Element &&
        (block as TransitionBlock).$transition &&
        !(block as TransitionBlock).$transition!.disabled
      ) {
        performTransitionEnter(
          block,
          (block as TransitionBlock).$transition as TransitionHooks,
          () => parent.insertBefore(block, anchor as Node),
          parentSuspense,
        )
      } else {
        parent.insertBefore(block, anchor)
      }
    }
  } else if (isVaporComponent(block)) {
    if (block.isMounted && !block.isDeactivated) {
      insert(block.block!, parent, anchor)
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (const b of block) {
      insert(b, parent, anchor)
    }
  } else {
    if (block.anchor) {
      insert(block.anchor, parent, anchor)
      anchor = block.anchor
    }
    // fragment
    if (block.insert) {
      block.insert(parent, anchor, (block as TransitionBlock).$transition)
    } else {
      insert(block.nodes, parent, anchor, parentSuspense)
    }
  }
}

export type InsertFn = typeof insert

export function prepend(parent: ParentNode, ...blocks: Block[]): void {
  let i = blocks.length
  while (i--) insert(blocks[i], parent, 0)
}

export function remove(block: Block, parent?: ParentNode): void {
  if (block instanceof Node) {
    if ((block as TransitionBlock).$transition && block instanceof Element) {
      performTransitionLeave(
        block,
        (block as TransitionBlock).$transition as TransitionHooks,
        () => parent && parent.removeChild(block),
      )
    } else {
      parent && parent.removeChild(block)
    }
  } else if (isVaporComponent(block)) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      remove(block[i], parent)
    }
  } else {
    // fragment
    if (block.remove) {
      block.remove(parent, (block as TransitionBlock).$transition)
    } else {
      remove(block.nodes, parent)
    }
    if (block.anchor) remove(block.anchor, parent)
    if ((block as DynamicFragment).scope) {
      ;(block as DynamicFragment).scope!.stop()
      const scopes = (block as DynamicFragment).keptAliveScopes
      if (scopes) {
        scopes.forEach(scope => scope.stop())
        scopes.clear()
      }
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
    if (block instanceof TeleportFragment) {
      nodes.push(block.placeholder!, block.anchor!)
    } else {
      nodes.push(...normalizeBlock(block.nodes))
      block.anchor && nodes.push(block.anchor)
    }
  }
  return nodes
}

export function findBlockNode(block: Block): {
  parentNode: Node | null
  nextNode: Node | null
} {
  let { parentNode, nextSibling: nextNode } = findLastChild(block)!

  // if nodes render as a fragment and the current nextNode is fragment
  // end anchor, need to move to the next node
  if (nextNode && isComment(nextNode, ']') && isFragmentBlock(block)) {
    nextNode = nextNode.nextSibling
  }

  return {
    parentNode,
    nextNode,
  }
}

function findLastChild(node: Block): Node | undefined | null {
  if (node && node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return findLastChild(node[node.length - 1])
  } else if (isVaporComponent(node)) {
    return findLastChild(node.block!)
  } else {
    if (node.anchor) return node.anchor
    return findLastChild(node.nodes!)
  }
}

export function isFragmentBlock(block: Block): boolean {
  if (isArray(block)) {
    return true
  } else if (isVaporComponent(block)) {
    return isFragmentBlock(block.block!)
  } else if (isFragment(block)) {
    return isFragmentBlock(block.nodes)
  }
  return false
}

export function setScopeId(block: Block, scopeIds: string[]): void {
  if (block instanceof Element) {
    for (const id of scopeIds) {
      block.setAttribute(id, '')
    }
  } else if (isVaporComponent(block)) {
    setScopeId(block.block, scopeIds)
  } else if (isArray(block)) {
    for (const b of block) {
      setScopeId(b, scopeIds)
    }
  } else if (isFragment(block)) {
    setScopeId(block.nodes, scopeIds)
  }
}

export function setComponentScopeId(instance: VaporComponentInstance): void {
  const parent = instance.parent
  if (!parent) return
  // prevent setting scopeId on multi-root fragments
  if (isArray(instance.block) && instance.block.length > 1) return

  const scopeIds: string[] = []

  const scopeId = parent.type.__scopeId
  if (scopeId) {
    scopeIds.push(scopeId)
  }

  // inherit scopeId from vdom parent
  if (
    parent.subTree &&
    (parent.subTree.component as any) === instance &&
    parent.vnode!.scopeId
  ) {
    scopeIds.push(parent.vnode!.scopeId)
    const inheritedScopeIds = getInheritedScopeIds(parent.vnode!, parent.parent)
    scopeIds.push(...inheritedScopeIds)
  }

  if (scopeIds.length > 0) {
    setScopeId(instance.block, scopeIds)
  }
}
