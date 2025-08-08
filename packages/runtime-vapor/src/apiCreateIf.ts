import { ELSE_IF_ANCHOR_LABEL, IF_ANCHOR_LABEL } from '@vue/shared'
import { type Block, type BlockFn, insert } from './block'
import { advanceHydrationNode, isHydrating } from './dom/hydration'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { renderEffect } from './renderEffect'
import { DynamicFragment } from './fragment'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
  elseIf?: boolean,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()

  let frag: Block
  if (once) {
    frag = condition() ? b1() : b2 ? b2() : []
  } else {
    frag =
      isHydrating || __DEV__
        ? new DynamicFragment(
            elseIf && isHydrating ? ELSE_IF_ANCHOR_LABEL : IF_ANCHOR_LABEL,
          )
        : new DynamicFragment()
    renderEffect(() => (frag as DynamicFragment).update(condition() ? b1 : b2))
  }

  if (!isHydrating) {
    if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  } else {
    // if _insertionAnchor is defined, insertionParent contains a static node
    // that should be skipped during hydration.
    // Advance to the next sibling node to bypass this static node.
    if (_insertionAnchor !== undefined) {
      advanceHydrationNode(_insertionParent!)
    }
  }

  return frag
}
