import { type Block, type BlockFn, insert } from './block'
import { advanceHydrationNode, isHydrating } from './dom/hydration'
import {
  insertionAnchor,
  insertionParent,
  isLastInsertion,
  resetInsertionState,
} from './insertionState'
import { renderEffect } from './renderEffect'
import { DynamicFragment } from './fragment'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _isLastInsertion = isLastInsertion
  if (!isHydrating) resetInsertionState()

  let frag: Block
  if (once) {
    frag = condition() ? b1() : b2 ? b2() : []
  } else {
    frag =
      isHydrating || __DEV__ ? new DynamicFragment('if') : new DynamicFragment()
    renderEffect(() => (frag as DynamicFragment).update(condition() ? b1 : b2))
  }

  if (!isHydrating) {
    if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  } else {
    if (_isLastInsertion) {
      advanceHydrationNode(_insertionParent!)
    }
  }

  return frag
}
