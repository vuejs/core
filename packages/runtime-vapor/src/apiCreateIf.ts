import { type Block, type BlockFn, insert } from './block'
import {
  type HydrationCursor,
  advanceHydrationNode,
  currentHydrationNode,
  enterHydrationCursor,
  exitHydrationCursor,
  isHydrating,
} from './dom/hydration'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { renderEffect } from './renderEffect'
import { DynamicFragment } from './fragment'
import { createComment, createTextNode } from './dom/node'
import { VaporBlockShape } from '@vue/shared'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  blockShape?: number,
  once?: boolean,
  index?: number,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()
  let hydrationCursor: HydrationCursor | null = null
  let branchShape: VaporBlockShape | undefined

  let frag: Block
  if (once) {
    const ok = condition()
    if (isHydrating) {
      branchShape = decodeIfShape(blockShape!, ok)
      hydrationCursor = enterHydrationCursor(
        branchShape === VaporBlockShape.MULTI_ROOT,
      )
    }
    frag = ok
      ? b1()
      : b2
        ? b2()
        : [__DEV__ ? createComment('if') : createTextNode()]
  } else {
    // DynamicFragment should be keyed for correct transition behavior
    const keyed = index != null
    frag =
      isHydrating || __DEV__
        ? new DynamicFragment('if', keyed, false)
        : new DynamicFragment(undefined, keyed, false)
    renderEffect(() => {
      const ok = condition()
      if (isHydrating) {
        branchShape = decodeIfShape(blockShape!, ok)
        hydrationCursor = enterHydrationCursor(
          branchShape === VaporBlockShape.MULTI_ROOT,
        )
      }
      ;(frag as DynamicFragment).update(
        ok ? b1 : b2,
        keyed ? index * 2 + (ok ? 0 : 1) : undefined,
      )
    })
  }

  if (!isHydrating) {
    if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  } else {
    // SSR empty branches render as <!---->, and no template adoption consumes
    // that comment. Claim it before restoring the outer cursor.
    if (branchShape === VaporBlockShape.EMPTY && hydrationCursor) {
      const start = hydrationCursor.start
      if (
        start &&
        currentHydrationNode === start &&
        start.nodeType === 8 &&
        (start as Comment).data === ''
      ) {
        advanceHydrationNode(start)
      }
    }
    exitHydrationCursor(hydrationCursor)
  }

  return frag
}

// The compiler packs the true/false branch shapes into one integer:
//   packed = trueShape | (falseShape << 2)
//
// Each branch shape fits in 2 bits:
//   EMPTY       = 0b00
//   SINGLE_ROOT = 0b01
//   MULTI_ROOT  = 0b10
//
// Example:
//   trueShape  = MULTI_ROOT  = 0b10
//   falseShape = SINGLE_ROOT = 0b01
//   packed     = 0b10 | (0b01 << 2) = 0b0110
//
// To read the active branch:
// - true branch:  shift by 0, then keep the low 2 bits -> 0b10
// - false branch: shift by 2, then keep the low 2 bits -> 0b01
//
// `0b11` is the binary mask for the low 2 bits (decimal `3`).
// `value & 0b11` clears everything except the active branch shape.
function decodeIfShape(shape: number, ok: boolean): VaporBlockShape {
  return ((shape >> (ok ? 0 : 2)) & 0b11) as VaporBlockShape
}
