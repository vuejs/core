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
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
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
    // After block node hydration is completed, advance currentHydrationNode to
    // _insertionParent's next sibling if _insertionAnchor has a value
    // _insertionAnchor values:
    // 1. Node type: _insertionAnchor is a static node, no hydration needed
    // 2. null: block node is appended, potentially without next sibling
    // 3. 0: next sibling of current block node is static, no hydration needed
    if (_insertionAnchor !== undefined) {
      advanceHydrationNode(_insertionParent!)
    }
  }

  return frag
}
