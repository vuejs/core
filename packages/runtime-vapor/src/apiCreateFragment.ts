import { type Block, type BlockFn, removeNode } from './block'
import {
  type HydrationCursor,
  captureHydrationCursor,
  isHydrating,
} from './dom/hydration'
import { DynamicFragment, finishBlockCreation } from './fragment'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { renderEffect } from './renderEffect'

/**
 * Create a dynamic fragment keyed by a reactive value for Vapor transitions.
 * The fragment is re-rendered when the key changes to trigger enter/leave
 * animations.
 *
 * Example:
 * <VaporTransition>
 *   <h1 :key="count">{{ count }}</h1>
 * </VaporTransition>
 */
export function createKeyedFragment(
  key: () => any,
  render: BlockFn,
  trackSlotBoundary: boolean = false,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()
  const hydrationCursor: HydrationCursor | null = isHydrating
    ? captureHydrationCursor()
    : null

  const frag = new DynamicFragment(
    0,
    __DEV__ ? 'keyed' : undefined,
    true,
    true,
    trackSlotBoundary,
    trackSlotBoundary
      ? () => {
          const parent = frag.anchor.parentNode
          if (parent) removeNode(frag.anchor, parent)
        }
      : undefined,
    _insertionAnchor,
  )

  renderEffect(() => frag.update(render, key()))

  finishBlockCreation(
    frag,
    frag.anchor,
    hydrationCursor,
    _insertionParent,
    _insertionAnchor,
  )
  return frag
}
