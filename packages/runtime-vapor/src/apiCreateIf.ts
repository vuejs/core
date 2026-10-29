import { type Block, type BlockFn, insert } from './block'
import {
  type FragmentClaim,
  type HydrationCursor,
  advanceHydrationNode,
  claimUntrackedAnchor,
  createFragmentClaim,
  currentHydrationNode,
  enterHydrationCursor,
  hydrateBlock,
  hydrateChainBranch,
  isComment,
  isHydrating,
  locateClaimedEnd,
  runWithoutHydration,
  trimHydrationBoundary,
} from './dom/hydration'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { renderEffect } from './renderEffect'
import { DynamicFragment, finishBlockCreation } from './fragment'
import { hydrateDynamicFragmentAnchor } from './dom/hydrateFragment'
import { IF } from './fragmentFlags'
import { createComment, createTextNode } from './dom/node'
import { VaporBlockShape, VaporIfFlags } from '@vue/shared'

// The position in its chain of the branch a hydrating `createIf` renders when
// its condition holds: a short `v-else-if` chain compiles to nested calls, and
// the call whose false branch is the rest of the chain (`ELSE_IF`) sets it just
// before running that branch, whose first statement is the next call.
let nextChainPosition = 0

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
  let position = 0
  let inChain = false
  if (isHydrating) {
    position = nextChainPosition
    nextChainPosition = 0
    inChain = position > 0 || !!b2
  }
  let hydrationCursor: HydrationCursor | null = null
  let branchShape: VaporBlockShape | undefined
  // the fragment's own anchor, when it has one; the `v-if` once path has none
  let anchor: Node | undefined

  let frag: Block
  if (flags & VaporIfFlags.ONCE) {
    const ok = condition()
    let claim: FragmentClaim | undefined
    let otherBranch: Node | null = null
    if (isHydrating) {
      branchShape = decodeIfShape(flags, ok)
      claim =
        branchShape === VaporBlockShape.MULTI_ROOT
          ? createFragmentClaim()
          : undefined
      hydrationCursor = enterHydrationCursor(claim)
      if (branchShape === VaporBlockShape.ELSE_IF) {
        nextChainPosition = position + 1
      } else if (inChain) {
        otherBranch = hydrateChainBranch(
          (claim ||= createFragmentClaim()),
          ok ? position : position + 1,
        )
      }
    }
    if (isHydrating && !ok && !b2) {
      // Resolve the empty branch's SSR anchor without installing an effect:
      // the close of a server branch the chain dropped, or a placeholder's.
      if (otherBranch) {
        frag = [otherBranch]
      } else {
        const placeholder = new DynamicFragment(IF, __DEV__ ? 'if' : undefined)
        placeholder.hydrationClaim = claim
        hydrateDynamicFragmentAnchor(placeholder, true)
        frag = [placeholder.anchor]
      }
    } else {
      const render = ok ? b1 : b2
      frag = !render
        ? [
            claimUntrackedAnchor(
              __DEV__ ? createComment('if') : createTextNode(),
            ),
          ]
        : otherBranch
          ? runWithoutHydration(() => {
              // the server rendered another branch: this one goes in its range
              const block = render()
              insert(block, otherBranch!.parentNode!, otherBranch)
              return block
            })
          : isHydrating
            ? hydrateBlock(render)
            : render()
    }
    if (isHydrating && claim && claim.start) {
      // Non-empty v-once branches have no DynamicFragment to consume the
      // close: drop what the branch left in its range, then step past it.
      const close = locateClaimedEnd(claim.start)!
      trimHydrationBoundary(close)
      advanceHydrationNode(close)
    }
  } else {
    // DynamicFragment should be keyed for correct transition behavior
    // and KeepAlive cache identity. The encoded value is index + 1, so 0 is
    // the unkeyed sentinel and source index 0 becomes encoded index 1.
    const index = flags >> VaporIfFlags.INDEX_SHIFT
    const keyed = index > 0
    const keyBase = keyed ? (index - 1) * 2 : 0
    const trackSlotBoundary = !!(flags & VaporIfFlags.SLOT_ROOT)
    const dynamicFragment = new DynamicFragment(
      IF,
      __DEV__ ? 'if' : undefined,
      keyed,
      trackSlotBoundary,
      _insertionAnchor,
    )
    anchor = dynamicFragment.anchor
    frag = dynamicFragment
    renderEffect(() => {
      const ok = condition()
      let otherBranch: Node | null = null
      if (isHydrating) {
        branchShape = decodeIfShape(flags, ok)
        dynamicFragment.hydrationClaim =
          branchShape === VaporBlockShape.MULTI_ROOT
            ? createFragmentClaim()
            : undefined
        hydrationCursor = enterHydrationCursor(dynamicFragment.hydrationClaim)
        if (branchShape === VaporBlockShape.ELSE_IF) {
          nextChainPosition = position + 1
        } else if (inChain) {
          otherBranch = hydrateChainBranch(
            (dynamicFragment.hydrationClaim ||= createFragmentClaim()),
            ok ? position : position + 1,
          )
        }
      }
      const render = ok ? b1 : b2
      const key = keyed ? keyBase + (ok ? 0 : 1) : undefined
      const noScope = isNoScopeBranch(flags, ok)
      if (otherBranch) {
        // the server rendered another branch: this one goes in its range
        dynamicFragment.anchor = otherBranch
        runWithoutHydration(() => dynamicFragment.update(render, key, noScope))
      } else {
        dynamicFragment.update(render, key, noScope)
      }
    })
  }

  // SSR empty branches render as <!---->, and no template adoption consumes
  // that comment. Claim it before restoring the outer cursor.
  if (isHydrating && branchShape === VaporBlockShape.EMPTY && hydrationCursor) {
    const start = hydrationCursor.start
    if (start && currentHydrationNode === start && isComment(start, '')) {
      advanceHydrationNode(start)
    }
  }

  finishBlockCreation(
    frag,
    anchor,
    hydrationCursor,
    _insertionParent,
    _insertionAnchor,
  )

  return frag
}

// The compiler packs the true/false branch shapes into the low bits:
//   packed = trueShape | (falseShape << 2)
//
// Each branch shape fits in 2 bits:
//   EMPTY       = 0b00
//   SINGLE_ROOT = 0b01
//   MULTI_ROOT  = 0b10
//   ELSE_IF     = 0b11 (false branch only)
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
