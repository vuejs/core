import { type Block, type BlockFn, insert } from './block'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { renderEffect } from './renderEffect'
import { DynamicFragment } from './fragment'
import { createComment, createTextNode } from './dom/node'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
  index?: number,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  let frag: Block
  if (once) {
    frag = condition()
      ? b1()
      : b2
        ? b2()
        : [__DEV__ ? createComment('if') : createTextNode()]
  } else {
    // DynamicFragment should be keyed for correct transition behavior
    const keyed = index != null
    frag = __DEV__
      ? new DynamicFragment('if', keyed)
      : new DynamicFragment(undefined, keyed)
    renderEffect(() => {
      const ok = condition()
        ; (frag as DynamicFragment).update(
          ok ? b1 : b2,
          keyed ? `${index}${ok ? 0 : 1}` : undefined,
        )
    })
  }

  if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)

  return frag
}
