import { isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { isHydrating } from './dom/hydration'
import {
  type DynamicFragment,
  type VaporFragment,
  isFragment,
} from './fragment'
import { TeleportFragment } from './components/Teleport'
import {
  type TransitionHooks,
  type TransitionProps,
  type TransitionState,
  performTransitionEnter,
  performTransitionLeave,
} from '@vue/runtime-dom'

export interface TransitionOptions {
  $key?: any
  $transition?: VaporTransitionHooks
}

export interface VaporTransitionHooks extends TransitionHooks {
  state: TransitionState
  props: TransitionProps
  instance: VaporComponentInstance
  // mark transition hooks as disabled so that it skips during
  // inserting
  disabled?: boolean
}

export type TransitionBlock =
  | (Node & TransitionOptions)
  | (VaporFragment & TransitionOptions)
  | (DynamicFragment & TransitionOptions)

export type Block = TransitionBlock | VaporComponentInstance | Block[]

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
  parent: ParentNode & { $anchor?: Node | null },
  anchor: Node | null | 0 = null, // 0 means prepend
  parentSuspense?: any, // TODO Suspense
): void {
  anchor = anchor === 0 ? parent.$anchor || parent.firstChild : anchor
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
      // TODO handle hydration for vdom interop
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
