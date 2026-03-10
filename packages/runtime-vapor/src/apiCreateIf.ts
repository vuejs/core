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
import { createComment, createTextNode } from './dom/node'
import type { VaporBlockShape } from '@vue/shared'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
  index?: number,
  branchShape?: number,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _isLastInsertion = isLastInsertion
  if (!isHydrating) resetInsertionState()

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
    frag =
      isHydrating || __DEV__
        ? new DynamicFragment('if', keyed)
        : new DynamicFragment(undefined, keyed)
    renderEffect(() => {
      const ok = condition()
      const shape =
        isHydrating && branchShape != null
          ? decodeIfBranchShape(branchShape, ok)
          : undefined
      ;(frag as DynamicFragment).update(
        ok ? b1 : b2,
        keyed ? `${index}${ok ? 0 : 1}` : undefined,
        shape,
      )
    })
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

function decodeIfBranchShape(
  branchShape: number,
  ok: unknown,
): VaporBlockShape {
  // The compiler packs the true/false branch shapes into one integer.
  // Each branch uses 2 bits.
  // The true branch reads the low 2 bits; the false branch shifts right by 2
  // and then reads the low 2 bits.
  return ((branchShape >> (ok ? 0 : 2)) & 0b11) as VaporBlockShape
}
