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
  renderChainBranch,
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

/**
 * A long `v-if` / `v-else-if` chain as one fragment: `select` returns the
 * index of the branch to render, `blocks.length` when none matches. Nested
 * `createIf` calls would recurse once per branch at creation.
 *
 * `branchFlags[i]` carries branch i's shape in the low two bits and
 * `TRUE_NO_SCOPE`; its last entry describes the `v-else` branch or, without
 * one, the empty state. `null` means every branch is a scoped single root
 * and the empty state is empty.
 */
export function createIfChain(
  select: () => number,
  blocks: BlockFn[],
  branchFlags: number[] | null,
  flags: number,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()
  let hydrationCursor: HydrationCursor | null = null
  let branchShape: VaporBlockShape | undefined
  // the fragment's own anchor, when it has one; the once path has none
  let anchor: Node | undefined

  const branchFlag = (i: number): number =>
    branchFlags
      ? branchFlags[i]
      : blocks[i]
        ? VaporBlockShape.SINGLE_ROOT
        : VaporBlockShape.EMPTY

  let frag: Block
  if (flags & VaporIfFlags.ONCE) {
    const i = select()
    const render = blocks[i]
    let claim: FragmentClaim | undefined
    let otherBranch: Node | null = null
    if (isHydrating) {
      branchShape = branchFlag(i) & 0b11
      claim =
        branchShape === VaporBlockShape.MULTI_ROOT
          ? createFragmentClaim()
          : undefined
      hydrationCursor = enterHydrationCursor(claim)
      otherBranch = hydrateChainBranch((claim ||= createFragmentClaim()), i)
    }
    if (isHydrating && !render) {
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
    // Branch keys follow createIf's numbering: the compiler reserves the
    // chain's range of indexes, each index covering a pair of keys.
    const keyBase = ((flags >> VaporIfFlags.INDEX_SHIFT) - 1) * 2
    const dynamicFragment = new DynamicFragment(
      IF,
      __DEV__ ? 'if' : undefined,
      true,
      !!(flags & VaporIfFlags.SLOT_ROOT),
      _insertionAnchor,
    )
    anchor = dynamicFragment.anchor
    frag = dynamicFragment
    renderEffect(() => {
      const i = select()
      const flag = branchFlag(i)
      let otherBranch: Node | null = null
      if (isHydrating) {
        branchShape = flag & 0b11
        dynamicFragment.hydrationClaim =
          branchShape === VaporBlockShape.MULTI_ROOT
            ? createFragmentClaim()
            : undefined
        hydrationCursor = enterHydrationCursor(dynamicFragment.hydrationClaim)
        otherBranch = hydrateChainBranch(
          (dynamicFragment.hydrationClaim ||= createFragmentClaim()),
          i,
        )
      }
      const noScope = !!(flag & VaporIfFlags.TRUE_NO_SCOPE)
      if (otherBranch) {
        // the server rendered another branch: this one goes in its range
        renderChainBranch(
          dynamicFragment,
          otherBranch,
          blocks[i],
          keyBase + i,
          noScope,
        )
      } else {
        dynamicFragment.update(blocks[i], keyBase + i, noScope)
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
