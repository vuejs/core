import { type Block, type BlockFn, DynamicFragment, insert } from './block'
import {
  currentHydrationNode,
  isComment,
  isHydrating,
  locateHydrationNode,
} from './dom/hydration'
import { insertionAnchor, insertionParent } from './insertionState'
import { renderEffect } from './renderEffect'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  let _currentHydrationNode
  if (isHydrating) {
    locateHydrationNode()
    _currentHydrationNode = currentHydrationNode
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

  // if the current hydration node is a comment, use it as an anchor
  // otherwise need to insert the anchor node
  // OR adjust ssr output to add anchor for v-if
  else if (isHydrating && _currentHydrationNode) {
    const parentNode = _currentHydrationNode.parentNode
    if (parentNode) {
      if (isComment(_currentHydrationNode, '')) {
        if (__DEV__) _currentHydrationNode.data = 'if'
        ;(frag as DynamicFragment).anchor = _currentHydrationNode
      } else {
        parentNode.insertBefore(
          (frag as DynamicFragment).anchor,
          _currentHydrationNode.nextSibling,
        )
      }
    }
  }

  return frag
}
