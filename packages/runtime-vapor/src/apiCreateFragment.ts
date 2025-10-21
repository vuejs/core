import { type Block, type BlockFn, insert } from './block'
import { advanceHydrationNode, isHydrating } from './dom/hydration'
import { DynamicFragment } from './fragment'
import {
  insertionAnchor,
  insertionParent,
  isLastInsertion,
  resetInsertionState,
} from './insertionState'
import { renderEffect } from './renderEffect'

export function createKeyedFragment(key: () => any, render: BlockFn): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _isLastInsertion = isLastInsertion
  if (!isHydrating) resetInsertionState()

  const frag = __DEV__ ? new DynamicFragment('keyed') : new DynamicFragment()
  renderEffect(() => {
    frag.update(render, key())
  })

  if (!isHydrating) {
    if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  } else {
    if (_isLastInsertion) {
      advanceHydrationNode(_insertionParent!)
    }
  }
  return frag
}
