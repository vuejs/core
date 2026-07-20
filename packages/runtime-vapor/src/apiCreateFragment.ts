import { type Block, type BlockFn, insert } from './block'
import {
  type HydrationCursor,
  captureHydrationCursor,
  exitHydrationCursor,
  isHydrating,
} from './dom/hydration'
import { DynamicFragment } from './fragment'
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
export function createKeyedFragment(key: () => any, render: BlockFn): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()
  const hydrationCursor: HydrationCursor | null = isHydrating
    ? captureHydrationCursor()
    : null

  const frag = __DEV__
    ? new DynamicFragment('keyed', true)
    : new DynamicFragment(undefined, true)

  renderEffect(() => frag.update(render, key()))

  if (!isHydrating) {
    if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  } else {
    exitHydrationCursor(hydrationCursor)
  }
  return frag
}
