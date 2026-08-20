import { type Block, type BlockFn, insert, removeNode } from './block'
import {
  type HydrationCursor,
  captureHydrationCursor,
  exitHydrationCursor,
  isHydrating,
} from './dom/hydration'
import { DynamicFragment, isAdoptedAnchor } from './fragment'
import { DYNAMIC, OWNS_ANCHOR } from './fragmentFlags'
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
    DYNAMIC | OWNS_ANCHOR,
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

  if (!isHydrating) {
    // adopted fragments render in place through their template anchor
    if (_insertionParent && !isAdoptedAnchor(frag.anchor, _insertionAnchor)) {
      insert(frag, _insertionParent, _insertionAnchor)
    }
  } else {
    exitHydrationCursor(hydrationCursor)
  }
  return frag
}
