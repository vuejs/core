import { EMPTY_ARR, isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { _child } from './dom/node'
import { isComment, isHydrating } from './dom/hydration'
import {
  MoveType,
  type TransitionHooks,
  type TransitionProps,
  type TransitionState,
  performTransitionEnter,
  performTransitionLeave,
} from '@vue/runtime-dom'
import {
  type DynamicFragment,
  type VaporFragment,
  isFragment,
} from './fragment'
import { isTeleportEnabled, isTeleportFragment } from './teleport'
import { isTransitionEnabled } from './transition'
import { isInteropEnabled } from './vdomInteropState'

export interface VaporTransitionHooks extends TransitionHooks {
  state: TransitionState
  props: TransitionProps
  instance: VaporComponentInstance
  // Temporarily skips enter/move during TransitionGroup FLIP measurement.
  // Leave transitions intentionally ignore this flag.
  disabled?: boolean
  // TransitionGroup sets this to handle applying hooks to list children
  applyGroup?: (
    block: Block,
    props: TransitionProps,
    state: TransitionState,
    instance: VaporComponentInstance,
  ) => void
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

export const EMPTY_BLOCK: Block[] = EMPTY_ARR as unknown as Block[]

export function isBlock(val: NonNullable<unknown>): val is Block {
  return (
    val instanceof Node ||
    isArray(val) ||
    isVaporComponent(val) ||
    isFragment(val)
  )
}

export function isValidBlock(
  block: Block | null | undefined,
  componentAsValid: boolean = false,
): boolean {
  if (!block) {
    return false
  } else if (block instanceof Node) {
    return !(block instanceof Comment)
  } else if (isVaporComponent(block)) {
    return componentAsValid || isValidBlock(block.block, componentAsValid)
  } else if (isArray(block)) {
    return (
      block.length > 0 &&
      block.some(block => isValidBlock(block, componentAsValid))
    )
  } else {
    if (isInteropEnabled && block.isBlockValid) {
      return block.isBlockValid(componentAsValid)
    }
    return isValidBlock(block.nodes, componentAsValid)
  }
}

// Slot validity follows VDOM fallback semantics: a component root counts as
// provided content even when its rendered block is empty.
export function isValidSlot(block: Block | null | undefined): boolean {
  return isValidBlock(block, true)
}

export function insert(
  block: Block,
  parent: ParentNode & { $fc?: Node | null },
  anchor: Node | null | 0 = null, // 0 means prepend
  parentSuspense?: any, // TODO Suspense
): void {
  if (block instanceof Node) {
    insertNode(block, parent, anchor, parentSuspense)
    return
  }

  if (isVaporComponent(block)) {
    anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
    if (block.isMounted && !block.isDeactivated) {
      insert(block.block!, parent, anchor, parentSuspense)
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
    for (const b of block) {
      insert(b, parent, anchor, parentSuspense)
    }
  } else {
    insertFragment(block, parent, anchor, parentSuspense)
  }
}

export function insertNode(
  block: Node,
  parent: ParentNode & { $fc?: Node | null },
  anchor: Node | null | 0 = null, // 0 means prepend
  parentSuspense?: any, // TODO Suspense
): void {
  anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
  if (!isHydrating) {
    // only apply transition on Element nodes
    if (
      isTransitionEnabled &&
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
}

export function insertFragment(
  block: VaporFragment | DynamicFragment,
  parent: ParentNode & { $fc?: Node | null },
  anchor: Node | null | 0 = null, // 0 means prepend
  parentSuspense?: any, // TODO Suspense
): void {
  anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
  if (block.anchor) {
    insertNode(block.anchor, parent, anchor, parentSuspense)
    anchor = block.anchor
  }
  if (block.insert) {
    block.insert(
      parent,
      anchor,
      parentSuspense,
      (block as TransitionBlock).$transition,
    )
  } else {
    insert(block.nodes, parent, anchor, parentSuspense)
  }
}

export function move(
  block: Block,
  parent: ParentNode & { $fc?: Node | null },
  anchor: Node | null | 0 = null, // 0 means prepend
  moveType: MoveType = MoveType.LEAVE,
  parentComponent?: VaporComponentInstance,
  parentSuspense?: any, // TODO Suspense
): void {
  anchor = anchor === 0 ? parent.$fc || _child(parent) : anchor
  if (block instanceof Node) {
    // only apply transition on Element nodes
    if (
      isTransitionEnabled &&
      block instanceof Element &&
      (block as TransitionBlock).$transition &&
      !(block as TransitionBlock).$transition!.disabled &&
      moveType !== MoveType.REORDER
    ) {
      if (moveType === MoveType.ENTER) {
        performTransitionEnter(
          block,
          (block as TransitionBlock).$transition as TransitionHooks,
          () => parent.insertBefore(block, anchor as Node),
          parentSuspense,
          true,
        )
      } else {
        performTransitionLeave(
          block,
          (block as TransitionBlock).$transition as TransitionHooks,
          () => {
            // if the component is unmounted after leave finish, remove the block
            // to avoid retaining a detached node.
            if (
              moveType === MoveType.LEAVE &&
              parentComponent &&
              parentComponent.isUnmounted
            ) {
              block.remove()
            } else {
              parent.insertBefore(block, anchor as Node)
            }
          },
          parentSuspense,
          true,
        )
      }
    } else {
      parent.insertBefore(block, anchor)
    }
  } else if (isVaporComponent(block)) {
    if (block.isMounted) {
      move(
        block.block!,
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      )
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (const b of block) {
      move(b, parent, anchor, moveType, parentComponent, parentSuspense)
    }
  } else {
    if (block.anchor) {
      move(
        block.anchor,
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      )
      anchor = block.anchor
    }
    // fragment
    if (block.insert) {
      block.insert(
        parent,
        anchor,
        parentSuspense,
        (block as TransitionBlock).$transition,
      )
    } else {
      move(
        block.nodes,
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      )
    }
  }
}

export function prepend(parent: ParentNode, ...blocks: Block[]): void {
  let i = blocks.length
  while (i--) insert(blocks[i], parent, 0)
}

export function remove(block: Block, parent?: ParentNode): void {
  if (block instanceof Node) {
    removeNode(block, parent)
  } else if (isVaporComponent(block)) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      remove(block[i], parent)
    }
  } else {
    removeFragment(block, parent)
  }
}

export function removeNode(block: Node, parent?: ParentNode): void {
  if (
    isTransitionEnabled &&
    (block as TransitionBlock).$transition &&
    block instanceof Element
  ) {
    performTransitionLeave(
      block,
      (block as TransitionBlock).$transition as TransitionHooks,
      () => parent && parent.removeChild(block),
    )
  } else {
    parent && parent.removeChild(block)
  }
}

export function removeFragment(
  block: VaporFragment | DynamicFragment,
  parent?: ParentNode,
): void {
  const onRemove = block.onRemove
  if (onRemove) {
    for (let i = 0; i < onRemove.length; i++) {
      onRemove[i]()
    }
  }
  if (block.remove) {
    block.remove(parent, (block as TransitionBlock).$transition)
  } else {
    remove(block.nodes, parent)
  }
  if (block.anchor) removeNode(block.anchor, parent)
  if ((block as DynamicFragment).scope) {
    ;(block as DynamicFragment).scope!.stop()
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
    if (isTeleportEnabled && isTeleportFragment(block)) {
      nodes.push(block.placeholder!, block.anchor!)
    } else {
      nodes.push(...normalizeBlock(block.nodes))
      block.anchor && nodes.push(block.anchor)
    }
  }
  return nodes
}

export function findBlockBoundary(block: Block): {
  parentNode: Node | null
  nextNode: Node | null
} {
  const lastChild = findLastChild(block)!
  let { parentNode, nextSibling: nextNode } = lastChild

  // if nodes render as a fragment and the current nextNode is fragment
  // end anchor, need to move to the next node. Skip this when the block
  // already includes its own end or runtime empty text anchor.
  if (
    nextNode &&
    isComment(nextNode, ']') &&
    isFragmentBlock(block) &&
    !isComment(lastChild, ']') &&
    !(lastChild.nodeType === 3 && !(lastChild as Text).data)
  ) {
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
