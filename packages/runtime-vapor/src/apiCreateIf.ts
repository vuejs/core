import { type Block, type BlockFn, DynamicFragment, insert } from './block'
import { isHydrating, locateHydrationNode } from './dom/hydration'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { renderEffect } from './renderEffect'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (isHydrating) {
    locateHydrationNode()
  } else {
    resetInsertionState()
  }

  let frag: Block
  if (once) {
    frag = condition() ? b1() : b2 ? b2() : []
  } else {
    frag = __DEV__ ? new DynamicFragment('if') : new DynamicFragment()
    renderEffect(() => (frag as DynamicFragment).update(condition() ? b1 : b2))
  }

  if (!isHydrating && _insertionParent) {
    insert(frag, _insertionParent, _insertionAnchor)
  }

  return frag
}
