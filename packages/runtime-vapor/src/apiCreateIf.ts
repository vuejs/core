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
import { VaporBlockShape, VaporIfFlags } from '@vue/shared'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  // Default flags encode true single-root + false empty, matching the compiler's
  // only omitted-flags case.
  flags: number = VaporBlockShape.SINGLE_ROOT,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()
  let hydrationCursor: HydrationCursor | null = null
  let branchShape: VaporBlockShape | undefined

  let frag: Block
  if (flags & VaporIfFlags.ONCE) {
    const ok = condition()
    if (isHydrating) {
      branchShape = decodeIfShape(flags, ok)
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
    // and KeepAlive cache identity. The encoded value is index + 1, so 0 is
    // the unkeyed sentinel and source index 0 becomes encoded index 1.
    const index = flags >> VaporIfFlags.INDEX_SHIFT
    const keyed = index > 0
    const keyBase = keyed ? (index - 1) * 2 : 0
    frag =
      isHydrating || __DEV__
        ? new DynamicFragment('if', keyed, false)
        : new DynamicFragment(undefined, keyed, false)
    renderEffect(() => {
      const ok = condition()
      if (isHydrating) {
        branchShape = decodeIfShape(flags, ok)
        hydrationCursor = enterHydrationCursor(
          branchShape === VaporBlockShape.MULTI_ROOT,
        )
      }
      ;(frag as DynamicFragment).update(
        ok ? b1 : b2,
        keyed ? keyBase + (ok ? 0 : 1) : undefined,
        isNoScopeBranch(flags, ok),
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

// The compiler packs the true/false branch shapes into the low bits:
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
// `0b11` clears everything except the active branch shape; no-scope and index
// metadata live in higher bits and are decoded separately.
function decodeIfShape(shape: number, ok: boolean): VaporBlockShape {
  return ((shape >> (ok ? 0 : 2)) & 0b11) as VaporBlockShape
}

function isNoScopeBranch(flags: number, ok: boolean): boolean {
  return !!(
    flags & (ok ? VaporIfFlags.TRUE_NO_SCOPE : VaporIfFlags.FALSE_NO_SCOPE)
  )
}
