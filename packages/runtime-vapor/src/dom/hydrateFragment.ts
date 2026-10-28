import {
  type FragmentClaim,
  advanceHydrationNode,
  claimAnchor,
  claimUntrackedAnchor,
  cleanupHydrationTail,
  createFragmentClaim,
  currentHydrationNode,
  enterHydrationBoundary,
  hydrateBlock,
  hydrateNode,
  isClaimedAnchor,
  isComment,
  isInDeferredHydrationBoundary,
  isRangeEnd,
  locateClaimedEnd,
  locateEndAnchor,
  locateHydrationNode,
  nextLogicalSibling,
  removeFragmentNodes,
  runWithoutHydration,
  setCurrentHydrationNode,
  trimHydrationBoundary,
  warnHydrationNodeMismatch,
  withHydratingSlotFallback,
} from './hydration'
import {
  createComment,
  createTextNode,
  parentNode as getParentNode,
  updateLastLocatedLogicalChild,
} from './node'
import {
  type Block,
  type BlockFn,
  EMPTY_BLOCK,
  findBlockBoundary,
  insert,
  isValidBlock,
  isValidSlot,
} from '../block'
import type { DynamicFragment, SlotFragment } from '../fragment'
import type { SlotBoundaryContext } from '../slotBoundary'
import { recheckSlotResolution } from '../slotFragment'
import { IF, NATIVE_CHILDREN, SLOT } from '../fragmentFlags'

// The SSR range the slot boundary being hydrated owns.
let currentSlotClaim: FragmentClaim | null = null

/**
 * The close marker of that range, for a block rendered inside the boundary.
 * The content may still be under way, so it is walked to from the open marker
 * (once: the walk caches it), never read off the cursor.
 */
export function locateSlotEndAnchor(): Node | null {
  const claim = currentSlotClaim
  return claim && claim.start ? locateEndAnchor(claim.start) : null
}

/** Locates the boundary's SSR range and consumes its opening marker. */
export function withHydratingSlotBoundary<R>(fn: () => R): R {
  const claim = createFragmentClaim()
  locateHydrationNode(claim)
  const prev = currentSlotClaim
  currentSlotClaim = claim

  try {
    return fn()
  } finally {
    currentSlotClaim = prev
    // trim the range's unclaimed tail
    trimHydrationBoundary(claim.start ? locateClaimedEnd(claim.start) : null)
  }
}

/**
 * Insert an anchor at a position resolved during the hydration pass. Untracked
 * anchors hold no SSR logical position, so traversal steps over them and the
 * insert can happen right away. `nextNode` may already have been trimmed by
 * boundary cleanup, in which case the anchor is appended instead.
 */
export function insertUntrackedAnchor(
  parentNode: Node,
  nextNode: Node | null,
  anchor: Node,
): void {
  parentNode.insertBefore(
    anchor,
    nextNode && getParentNode(nextNode) === parentNode ? nextNode : null,
  )
}

/**
 * Whether `node` can serve as `frag`'s anchor. Beyond the SSR candidate
 * (`<!---->`), dev builds also accept a runtime anchor this fragment kind
 * already created: those carry the fragment's debug label as their comment
 * data, where prod uses unlabeled text nodes. A range close is never one: it
 * belongs to the list, row or slot whose range it closes.
 */
function isReusableAnchorCandidate(
  node: Node | null,
  frag?: DynamicFragment,
): node is Comment {
  return (
    !!node &&
    (isComment(node, '') ||
      (__DEV__ &&
        frag !== undefined &&
        ((frag.__vf & IF && isComment(node, 'v-if')) ||
          (frag.anchorLabel !== undefined &&
            isComment(node, frag.anchorLabel)))))
  )
}

function reuseOrCreateAfterAnchor(
  node: Node,
  resetNodes?: boolean,
): AnchorPlan {
  const parent = getParentNode(node)
  return isClaimedAnchor(node) && parent
    ? { kind: 'create', parent, next: node.nextSibling, resetNodes }
    : { kind: 'reuse', node, resetNodes }
}

export function prepareDeferredHydrationAnchor(
  frag: DynamicFragment,
  hasRender: boolean,
): boolean {
  const isRevivingDeferredBranch =
    isInDeferredHydrationBoundary() &&
    hasRender &&
    !(frag.__vf & SLOT) &&
    !isValidBlock(frag.nodes)

  const reusingDeferredAnchor =
    isRevivingDeferredBranch && !!frag.anchor && !!frag.anchor.parentNode

  // Deferred hydration can keep an empty wrapper fragment alive, then resolve
  // it to a real branch before hydration exits. Re-point the cursor at the
  // fragment-owned insertion anchor so the late branch inserts before that
  // anchor instead of consuming trailing hydrated siblings or the enclosing
  // slot boundary.
  if (isRevivingDeferredBranch) {
    const node = currentHydrationNode
    const anchor =
      frag.anchor ||
      (node && isRangeEnd(node) && node === locateSlotEndAnchor() ? node : null)
    if (anchor) {
      setCurrentHydrationNode(claimAnchor(anchor))
    }
  }

  return reusingDeferredAnchor
}

/**
 * How a dynamic fragment obtains its insertion anchor during hydration.
 * `resolveDynamicAnchor` is a pure query over the current hydration state,
 * so each SSR output shape maps to one assertable plan; `executeAnchorPlan`
 * performs all side effects.
 */
export type AnchorPlan =
  // Adopt an existing comment node as the fragment anchor.
  | { kind: 'reuse'; node: Node; resetNodes?: boolean }
  // Insert a fresh runtime anchor before `next`.
  // `mark` keeps an SSR node structural so boundary cleanup preserves it.
  | {
      kind: 'create'
      parent: Node
      next: Node | null
      mark?: Node
      resetNodes?: boolean
    }
  // Trim unclaimed SSR content first, then insert a fresh runtime anchor.
  // Only arises for empty fragments, so the stale block reference is cleared.
  | {
      kind: 'create-cleanup'
      parent: Node
      next: Node | null
      cleanupStart: Node
      cleanupUntil: Node | null
      cleanupContainer?: ParentNode
    }

/*
 * ## Anchor resolution protocol
 *
 * SSR output carries no dedicated anchors for dynamic blocks — only fragment
 * markers (`<!--[-->` / `<!--]-->`), empty placeholders (`<!---->`) and
 * teleport markers. Every dynamic fragment must therefore *infer* its anchor
 * from what the server happened to render, or create one of its own.
 * `resolveDynamicAnchor` encodes that inference as an ordered rule list;
 * the first rule that recognises the situation returns the plan.
 *
 * 1. `planReuseInjectedAnchor` — a native-children fragment finds the anchor
 *    `createPlainElement` seeded for it still under the cursor: adopt it.
 * 2. `planReuseOwnClose` — the fragment claimed its own SSR
 *    `<!--[-->…<!--]-->` range (slot outlets, multi-root `v-if` branches,
 *    see `FragmentClaim`): its close marker is the anchor, whatever the
 *    content turned out to be.
 * 3. `planEmptyBranch` — the client rendered nothing and owns no range.
 *    Claim a reusable SSR comment at the cursor, insert before a structural
 *    teleport anchor, or trim the unclaimed SSR range the empty branch
 *    leaves behind.
 * 4. `planRestartFromRuntimeComment` — the block is a bare runtime comment
 *    (an empty branch created earlier in this same pass): reuse it if it is
 *    still in the DOM, otherwise restart from the cursor and trim.
 * 5. `planFromBlockBoundary` — fallback: an empty block at the close of a
 *    range it does not own goes in front of that close; otherwise derive
 *    parent/next from the hydrated block itself (dynamic component, async
 *    component, keyed fragment with single-root content, anything whose
 *    range was stripped).
 *
 * Marker discipline: a plan that adopts an SSR node claims it with
 * `claimAnchor` (it keeps its logical position); a plan that creates a
 * runtime anchor claims it with `claimUntrackedAnchor` (it holds no
 * position, traversal skips it). `executeAnchorPlan` owns those side
 * effects; the rules above are pure queries.
 */

/** Rule 1: adopt the anchor createPlainElement injected for native children. */
function planReuseInjectedAnchor(
  frag: DynamicFragment,
): AnchorPlan | undefined {
  // Native-children fragments get a runtime anchor injected by
  // createPlainElement when SSR rendered no default-slot content. Whenever the
  // cursor still points at that injected anchor — the branch stayed empty, or
  // it revived and hydrated its content ahead of the anchor — adopt it
  // directly instead of creating a second one.
  if (
    frag.__vf & NATIVE_CHILDREN &&
    isClaimedAnchor(currentHydrationNode) &&
    getParentNode(currentHydrationNode!)
  ) {
    return { kind: 'reuse', node: currentHydrationNode! }
  }
}

/** Rule 2: the fragment owns an SSR range; its close marker is the anchor. */
function planReuseOwnClose(frag: DynamicFragment): AnchorPlan | undefined {
  // a slot's claim lives in the boundary session it hydrates in
  const claim = frag.__vf & SLOT ? currentSlotClaim : frag.hydrationClaim
  const close = claim && claim.start ? locateClaimedEnd(claim.start) : null
  // reuse it once, or create a fresh runtime anchor after it
  if (close) return reuseOrCreateAfterAnchor(close)
}

/** Rule 3: the client rendered nothing and owns no range. */
function planEmptyBranch(frag: DynamicFragment): AnchorPlan | undefined {
  const flags = frag.__vf

  // Empty fragments claim a current SSR anchor candidate directly. Later
  // fragments that need the same candidate create a fresh anchor after it.
  if (isReusableAnchorCandidate(currentHydrationNode, frag)) {
    return reuseOrCreateAfterAnchor(currentHydrationNode)
  }

  if (
    !(flags & NATIVE_CHILDREN) &&
    currentHydrationNode &&
    isComment(currentHydrationNode, 'teleport anchor')
  ) {
    const parentNode = getParentNode(currentHydrationNode)
    if (parentNode) {
      // Target-side teleport anchors are structural. Empty dynamic
      // fragments insert their own anchor before the target anchor
      // instead of consuming it as mismatched SSR content.
      return {
        kind: 'create',
        parent: parentNode,
        next: currentHydrationNode,
        mark: currentHydrationNode,
      }
    }
  }

  if (
    !(flags & SLOT) &&
    currentHydrationNode &&
    !isRangeEnd(currentHydrationNode)
  ) {
    const parentNode = getParentNode(currentHydrationNode)
    // Empty branch against non-empty SSR output has no block node to
    // derive an insertion point from, so use the current hydration range.
    if (flags & NATIVE_CHILDREN && parentNode) {
      return {
        kind: 'create-cleanup',
        parent: parentNode,
        next: null,
        cleanupStart: currentHydrationNode,
        cleanupUntil: null,
        cleanupContainer: parentNode,
      }
    }

    if (parentNode) {
      const anchor = nextLogicalSibling(currentHydrationNode)
      if (isReusableAnchorCandidate(anchor, frag) && getParentNode(anchor)) {
        return reuseOrCreateAfterAnchor(anchor, true)
      }
      return planTrimFromCursor(parentNode, anchor)
    }
  }
}

/** Trim the unclaimed SSR range at the cursor, then create a fresh anchor. */
function planTrimFromCursor(parent: Node, next: Node | null): AnchorPlan {
  return {
    kind: 'create-cleanup',
    parent,
    next,
    cleanupStart: currentHydrationNode!,
    cleanupUntil: next,
  }
}

/** Rule 4: the block is a bare runtime comment from earlier in this pass. */
function planRestartFromRuntimeComment(
  frag: DynamicFragment,
): AnchorPlan | undefined {
  if (isValidBlock(frag.nodes) || !(frag.nodes instanceof Comment)) {
    return
  }

  // Reuse an existing SSR comment anchor for empty dynamic-component /
  // async-component / keyed-fragment branches. Without this, hydration can
  // end up creating a detached runtime anchor and lose the parent/sibling
  // position needed for same-hydration branch flips.
  if (
    isReusableAnchorCandidate(frag.nodes, frag) &&
    getParentNode(frag.nodes)
  ) {
    return reuseOrCreateAfterAnchor(frag.nodes, true)
  }

  // Empty dynamic fragments can also start from a detached runtime comment
  // (for example client null against non-empty SSR content). In that case
  // derive the insertion point from the current hydration cursor rather
  // than from the detached block node, and let boundary cleanup trim the
  // SSR range before the next logical sibling.
  if (!getParentNode(frag.nodes) && currentHydrationNode) {
    const parentNode = getParentNode(currentHydrationNode)
    if (parentNode) {
      return planTrimFromCursor(
        parentNode,
        nextLogicalSibling(currentHydrationNode),
      )
    }
  }
}

/** Rule 5: derive the anchor position from the hydrated block itself. */
function planFromBlockBoundary(frag: DynamicFragment): AnchorPlan {
  // Covers: dynamic component, async component, keyed fragment, and any
  // fragment whose SSR range was stripped.
  const close = currentHydrationNode
  if (!isValidBlock(frag.nodes) && close && isRangeEnd(close)) {
    // A branch rendering nothing at the close of the range around it, e.g.
    // `<template v-else />` as the whole slot content the server dropped:
    // the close stays that range's anchor, the branch goes before it.
    return { kind: 'create', parent: close.parentNode!, next: close }
  }
  const node = findBlockBoundary(frag.nodes)
  return { kind: 'create', parent: node.parentNode!, next: node.nextNode }
}

export function resolveDynamicAnchor(
  frag: DynamicFragment,
  isEmpty: boolean,
): AnchorPlan {
  return (
    planReuseInjectedAnchor(frag) ||
    planReuseOwnClose(frag) ||
    (isEmpty ? planEmptyBranch(frag) : undefined) ||
    planRestartFromRuntimeComment(frag) ||
    planFromBlockBoundary(frag)
  )
}

export function executeAnchorPlan(
  frag: DynamicFragment,
  plan: AnchorPlan,
): void {
  let advanceAfterRestore: Node | null = null
  let exitHydrationBoundary: (() => void) | undefined

  const createRuntimeAnchor = (): Node =>
    (frag.anchor = claimUntrackedAnchor(
      __DEV__ ? createComment(frag.anchorLabel ?? '') : createTextNode(),
    ))

  try {
    switch (plan.kind) {
      case 'reuse': {
        if (plan.resetNodes) frag.nodes = EMPTY_BLOCK
        frag.anchor = claimAnchor(plan.node)
        if (currentHydrationNode === frag.anchor) {
          advanceHydrationNode(frag.anchor)
        } else {
          // Exiting the boundary below trims SSR nodes the cursor has not
          // consumed before the adopted anchor.
          exitHydrationBoundary = enterHydrationBoundary(frag.anchor)
          advanceAfterRestore = frag.anchor
        }
        break
      }
      case 'create': {
        if (plan.resetNodes) frag.nodes = EMPTY_BLOCK
        if (plan.mark) claimAnchor(plan.mark)
        insertUntrackedAnchor(plan.parent, plan.next, createRuntimeAnchor())
        break
      }
      case 'create-cleanup': {
        frag.nodes = EMPTY_BLOCK
        // Advance the cache to the surviving next sibling, or clear it when
        // cleanup reaches the tail.
        const cleanupParent = getParentNode(plan.cleanupStart)
        if (cleanupParent) {
          updateLastLocatedLogicalChild(
            cleanupParent,
            plan.cleanupStart,
            plan.cleanupUntil,
            1,
          )
        }
        if (plan.cleanupUntil) {
          exitHydrationBoundary = enterHydrationBoundary(plan.cleanupUntil)
        } else {
          cleanupHydrationTail(plan.cleanupStart, plan.cleanupContainer)
          setCurrentHydrationNode(null)
        }
        insertUntrackedAnchor(plan.parent, plan.next, createRuntimeAnchor())
        break
      }
    }
  } finally {
    exitHydrationBoundary && exitHydrationBoundary()
    if (advanceAfterRestore && currentHydrationNode === advanceAfterRestore) {
      advanceHydrationNode(advanceAfterRestore)
    }
  }
}

export function hydrateDynamicFragmentAnchor(
  frag: DynamicFragment,
  isEmpty = false,
): void {
  executeAnchorPlan(frag, resolveDynamicAnchor(frag, isEmpty))
}

/**
 * The hydrating half of `SlotFragment.updateSlot`. The range the server left
 * says what it rendered, so nothing is tried and taken back:
 * - `<!--(-->`: the fallback, with none of the content's output;
 * - `<!--[--><!--]-->`: nothing;
 * - anything else: the content.
 */
export function hydrateSlotFragmentContent(
  frag: SlotFragment,
  render: BlockFn,
  key: any,
): void {
  locateHydrationNode()
  const open = currentHydrationNode
  if (
    open &&
    isComment(open, '[') &&
    open.nextSibling &&
    isComment(open.nextSibling, ']')
  ) {
    // as on the client, inside the range
    const close = (frag.anchor = claimAnchor(open.nextSibling))
    runWithoutHydration(() => {
      frag.updateContent(render, key)
      recheckSlotResolution(frag)
    })
    advanceHydrationNode(close)
  } else if (open && isComment(open, '(')) {
    const close = (frag.anchor = claimAnchor(locateEndAnchor(open)!))
    hydrateSlotFallbackRange(
      {
        first: open.nextSibling!,
        close,
        boundary: frag.boundary,
        getContent: () => frag.getContent(),
      },
      () => {
        frag.updateContent(render, key)
        recheckSlotResolution(frag)
      },
    )
    advanceHydrationNode(close)
  } else {
    withHydratingSlotBoundary(() => {
      frag.updateContent(render, key)
      if (isValidSlot(frag.getContent())) {
        recheckSlotResolution(frag)
        hydrateDynamicFragmentAnchor(frag, !isValidBlock(frag.nodes))
      } else {
        // content the client finds empty: there is no fallback to adopt
        if (open) warnHydrationNodeMismatch(open, `slot fallback`)
        frag.syncNodes()
        hydrateDynamicFragmentAnchor(frag, true)
        runWithoutHydration(() => recheckSlotResolution(frag))
      }
    })
  }
}

// `<!--(-->`: the server rendered an outlet's fallback, from `first` up to
// `close`, in place of its content.
export interface SlotFallbackRange {
  first: Node
  close: Node
  // of that outlet; an interop slot fills it in as it renders, handing
  // `adopt` over as its `adoptFallback`
  boundary?: SlotBoundaryContext
  adopt?: (render: BlockFn) => Block
  // the slot's content, to go ahead of the fallback once that is adopted
  getContent?: () => Block
}

/**
 * The nodes in the range are the fallback's: `createContent` runs the slot
 * content without hydration and places it as on the client. The fallback is
 * adopted from within it, by the slot providing it (see
 * `renderSlotFallbacks`), and never moves.
 */
export function hydrateSlotFallbackRange(
  range: SlotFallbackRange,
  createContent: () => void,
): void {
  const first = range.first
  const last = range.close.previousSibling!
  // what precedes the fallback outlives a mismatch replacing its nodes
  let before: Node | undefined
  // The content is created without hydration, and the fallback rendered from
  // within that: it alone has something to adopt, unless it rendered nothing.
  if (first !== range.close) {
    range.adopt = render => {
      before = first.previousSibling!
      // A mismatch drops what the fallback no longer adopts of its own server
      // nodes, which end at `last`. What the content placed behind them (vdom
      // content in a vapor outlet keeps its anchors there) is not its to drop.
      const stop = nextLogicalSibling(last)!
      return hydrateNode(first, () => hydrateBlock(render, stop))
    }
    if (range.boundary) range.boundary.adoptFallback = range.adopt
  }
  withHydratingSlotFallback(() => {
    createContent()
    // The content was created at the cursor, behind the fallback adopted
    // where the server put it; it goes ahead of it, as on the client, while
    // still out of hydration (inserts are skipped under it). Content the
    // slot has no DOM for (vdom content in a vapor outlet) passes none.
    const getContent = range.getContent
    if (before && getContent) {
      insert(getContent(), before.parentNode!, before.nextSibling)
    }
  })
  const boundary = range.boundary
  if (boundary && boundary.adoptFallback) {
    // the client has content after all: nothing of the fallback is kept
    warnHydrationNodeMismatch(first, `slot content`)
    boundary.adoptFallback = undefined
    removeFragmentNodes(first.previousSibling!, last.nextSibling!)
  }
}
