import { isArray } from '@vue/shared'
import {
  advanceHydrationNode,
  claimAnchor,
  claimUntrackedAnchor,
  cleanupHydrationTail,
  currentHydrationNode,
  enterHydrationBoundary,
  isClaimedAnchor,
  isComment,
  isInDeferredHydrationBoundary,
  locateEndAnchor,
  locateHydrationBoundaryClose,
  locateHydrationNode,
  nextLogicalSibling,
  setCurrentHydrationNode,
} from './hydration'
import {
  createComment,
  createTextNode,
  parentNode as getParentNode,
  updateLastLocatedLogicalChild,
} from './node'
import { EMPTY_BLOCK, findBlockBoundary, isValidBlock } from '../block'
import type { DynamicFragment } from '../fragment'
import { IF, OWNS_ANCHOR, SLOT } from '../fragmentFlags'

interface HydratingSlotBoundaryState {
  endAnchor: Node | null
  // Slot content is still resolving whether it should claim the SSR range.
  pending: boolean
  pendingAnchors: PendingSlotContentAnchor[] | null
}

let currentHydratingSlotBoundaryState: HydratingSlotBoundaryState | null = null

interface PendingSlotContentAnchor {
  onContent: () => void
  onFallback: () => void
}

export function getCurrentSlotEndAnchor(): Node | null {
  return currentHydratingSlotBoundaryState
    ? currentHydratingSlotBoundaryState.endAnchor
    : null
}

export function withHydratingSlotBoundary<R>(fn: () => R): R {
  let endAnchor = getCurrentSlotEndAnchor()
  let exitHydrationBoundary: (() => void) | undefined

  locateHydrationNode()
  if (isComment(currentHydrationNode!, '[')) {
    endAnchor = locateEndAnchor(currentHydrationNode)
    setCurrentHydrationNode(currentHydrationNode.nextSibling)
    exitHydrationBoundary = enterHydrationBoundary(endAnchor)
  }
  const prevState = currentHydratingSlotBoundaryState
  currentHydratingSlotBoundaryState = {
    endAnchor,
    pending: false,
    pendingAnchors: null,
  }

  try {
    return fn()
  } finally {
    currentHydratingSlotBoundaryState = prevState
    exitHydrationBoundary && exitHydrationBoundary()
  }
}

export function withPendingHydratingSlotBoundary<R>(fn: () => R): R {
  const pendingParent = currentHydratingSlotBoundaryState!
  const contentStart = currentHydrationNode
  let endAnchor = getCurrentSlotEndAnchor()
  let exitHydrationBoundary: (() => void) | undefined

  locateHydrationNode()
  if (isComment(currentHydrationNode!, '[')) {
    endAnchor = locateEndAnchor(currentHydrationNode)
    setCurrentHydrationNode(currentHydrationNode.nextSibling)
    exitHydrationBoundary = enterHydrationBoundary(endAnchor)
  }
  const state: HydratingSlotBoundaryState = {
    endAnchor,
    pending: true,
    pendingAnchors: null,
  }
  currentHydratingSlotBoundaryState = state
  let completed = false

  try {
    const result = fn()
    completed = true
    return result
  } finally {
    currentHydratingSlotBoundaryState = pendingParent
    if (!completed) {
      exitHydrationBoundary && exitHydrationBoundary()
    } else if (state.pending) {
      if (state.pendingAnchors) {
        ;(pendingParent.pendingAnchors ||= []).push(...state.pendingAnchors)
      }
      setCurrentHydrationNode(contentStart)
    } else {
      exitHydrationBoundary && exitHydrationBoundary()
      resolvePendingSlotContentAnchors(pendingParent, true)
      pendingParent.pending = false
    }
  }
}

function resolvePendingSlotContentAnchors(
  state: HydratingSlotBoundaryState,
  contentValid: boolean,
  startIndex: number = 0,
): void {
  // Empty fragments rendered before the slot decision wait until content wins
  // before claiming the current SSR anchor candidate.
  const pendingAnchors = state.pendingAnchors
  if (!pendingAnchors) return
  const anchors = startIndex
    ? pendingAnchors.splice(startIndex)
    : pendingAnchors
  if (!startIndex) state.pendingAnchors = null
  for (let i = 0; i < anchors.length; i++) {
    const pendingAnchor = anchors[i]
    if (contentValid) {
      pendingAnchor.onContent()
    } else {
      pendingAnchor.onFallback()
    }
  }
}

export function queuePendingSlotContentAnchor(
  anchor: PendingSlotContentAnchor,
): boolean {
  const state = currentHydratingSlotBoundaryState
  if (state && state.pending) {
    ;(state.pendingAnchors ||= []).push(anchor)
    return true
  }
  return false
}

// Slot content with fallback is unresolved until it creates a valid node.
// While unresolved, empty content branches must not consume fallback SSR anchors.
export function startPendingSlotContent(
  start: Node | null,
): (contentValid: boolean) => void {
  const state = currentHydratingSlotBoundaryState
  if (!state) return () => {}
  const prevPending = state.pending
  const pendingAnchorStart = state.pendingAnchors
    ? state.pendingAnchors.length
    : 0
  state.pending = true
  let active = true
  return contentValid => {
    if (!active) return
    active = false
    resolvePendingSlotContentAnchors(
      state,
      contentValid,
      !contentValid && prevPending ? pendingAnchorStart : 0,
    )
    state.pending = prevPending
    if (!contentValid) {
      setCurrentHydrationNode(start)
    }
  }
}

export function resolvePendingSlotContent(): void {
  const state = currentHydratingSlotBoundaryState
  if (state && state.pending) {
    resolvePendingSlotContentAnchors(state, true)
    state.pending = false
  }
}

export function isPendingSlotContent(): boolean {
  const state = currentHydratingSlotBoundaryState
  return !!(state && state.pending)
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
 * Whether `node` can serve as `frag`'s anchor. Beyond the SSR candidates
 * (`<!---->` and a fragment close), dev builds also accept a runtime anchor
 * this fragment kind already created: those carry the fragment's debug label
 * as their comment data, where prod uses unlabeled text nodes.
 */
function isReusableAnchorCandidate(
  node: Node | null,
  frag?: DynamicFragment,
): node is Comment {
  return (
    !!node &&
    (isComment(node, '') ||
      isComment(node, ']') ||
      (__DEV__ &&
        frag !== undefined &&
        frag.anchorLabel !== undefined &&
        isComment(node, frag.anchorLabel)))
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
    let slotEndAnchor: Node | null = null
    const anchor =
      frag.anchor ||
      (currentHydrationNode === (slotEndAnchor = getCurrentSlotEndAnchor())
        ? slotEndAnchor
        : null)
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
  // Delay an invalid slot-content anchor until content/fallback is decided.
  // If fallback wins, the content anchor is created detached.
  | {
      kind: 'pending'
      parent: Node
      slotEnd: Node | null
    }
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
 * 1. `planPendingSlotDecision` — slot content vs fallback is still
 *    undecided, so claiming anything now could steal the fallback's nodes.
 *    Defer the whole decision (`pending`).
 * 2. `planReuseInjectedAnchor` — a native-children fragment finds the anchor
 *    `createPlainElement` seeded for it still under the cursor: adopt it.
 * 3. `planEmptyBranch` — the client rendered nothing. Claim a reusable SSR
 *    comment at the cursor, insert before a structural teleport anchor, or
 *    trim the unclaimed SSR range the empty branch leaves behind.
 * 4. `planRestartFromRuntimeComment` — the block is a bare runtime comment
 *    (an empty branch created earlier in this same pass): reuse it if it is
 *    still in the DOM, otherwise restart from the cursor and trim.
 * 5. `planReuseBoundaryClose` — slots and multi-root `v-if` branches sit in
 *    an SSR `<!--[-->…<!--]-->` range whose close marker is a stable anchor.
 * 6. `planFromBlockBoundary` — fallback: derive parent/next from the
 *    hydrated block itself (dynamic component, async component, keyed
 *    fragment with single-root content).
 *
 * Marker discipline: a plan that adopts an SSR node claims it with
 * `claimAnchor` (it keeps its logical position); a plan that creates a
 * runtime anchor claims it with `claimUntrackedAnchor` (it holds no
 * position, traversal skips it). `executeAnchorPlan` owns those side
 * effects; the rules above are pure queries.
 */

/** Rule 1: the enclosing slot has not decided content vs fallback yet. */
function planPendingSlotDecision(
  frag: DynamicFragment,
  isEmpty: boolean,
): AnchorPlan | undefined {
  // A render function can still produce invalid slot content. Keep its anchor
  // pending just like an empty branch so fallback cleanup cannot detach the
  // insertion point before the runtime anchor is created.
  if (isPendingSlotContent() && (isEmpty || !isValidBlock(frag.nodes))) {
    const slotEnd = getCurrentSlotEndAnchor()
    const node = currentHydrationNode || slotEnd
    if (node) {
      const parent = getParentNode(node)
      if (parent) {
        return { kind: 'pending', parent, slotEnd }
      }
    }
  }
}

/** Rule 2: adopt the anchor createPlainElement injected for native children. */
function planReuseInjectedAnchor(
  frag: DynamicFragment,
): AnchorPlan | undefined {
  // Native-children fragments get a runtime anchor injected by
  // createPlainElement when SSR rendered no default-slot content. Whenever the
  // cursor still points at that injected anchor — the branch stayed empty, or
  // it revived and hydrated its content ahead of the anchor — adopt it
  // directly instead of creating a second one.
  if (
    frag.nativeChildren &&
    isClaimedAnchor(currentHydrationNode) &&
    getParentNode(currentHydrationNode!)
  ) {
    return { kind: 'reuse', node: currentHydrationNode! }
  }
}

/** Rule 3: the client rendered nothing for this branch. */
function planEmptyBranch(frag: DynamicFragment): AnchorPlan | undefined {
  const flags = frag.__vf

  // Empty fragments claim a current SSR anchor candidate directly. Later
  // fragments that need the same candidate create a fresh anchor after it.
  if (isReusableAnchorCandidate(currentHydrationNode)) {
    return reuseOrCreateAfterAnchor(currentHydrationNode)
  }

  if (!(flags & OWNS_ANCHOR)) return

  if (
    !frag.nativeChildren &&
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
    !isComment(currentHydrationNode, ']')
  ) {
    const parentNode = getParentNode(currentHydrationNode)
    // Empty branch against non-empty SSR output has no block node to
    // derive an insertion point from, so use the current hydration range.
    if (frag.nativeChildren && parentNode) {
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
      return {
        kind: 'create-cleanup',
        parent: parentNode,
        next: anchor,
        cleanupStart: currentHydrationNode,
        cleanupUntil: anchor,
      }
    }
  }
}

/** Rule 4: the block is a bare runtime comment from earlier in this pass. */
function planRestartFromRuntimeComment(
  frag: DynamicFragment,
): AnchorPlan | undefined {
  if (
    !(frag.__vf & OWNS_ANCHOR) ||
    isValidBlock(frag.nodes) ||
    !(frag.nodes instanceof Comment)
  ) {
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
    const nextNode = nextLogicalSibling(currentHydrationNode)
    if (parentNode) {
      return {
        kind: 'create-cleanup',
        parent: parentNode,
        next: nextNode,
        cleanupStart: currentHydrationNode,
        cleanupUntil: nextNode,
      }
    }
  }
}

/** Rule 5: slots and multi-root `v-if` reuse their SSR range's close marker. */
function planReuseBoundaryClose(frag: DynamicFragment): AnchorPlan | undefined {
  // Non-null only for slots, so it doubles as the "is a slot" test below.
  const slotAnchor = frag.__vf & SLOT ? getCurrentSlotEndAnchor() : null

  // SSR wraps slots and multi-root `v-if` branches with `<!--[-->...<!--]-->`.
  // The close marker is a valid stable anchor candidate: reuse it once, or
  // create a fresh runtime anchor after it when another fragment already did.
  if (
    slotAnchor ||
    (!!(frag.__vf & IF) && isArray(frag.nodes) && frag.nodes.length > 1)
  ) {
    const anchor = locateHydrationBoundaryClose(
      slotAnchor || currentHydrationNode!,
      slotAnchor || null,
    )
    if (isComment(anchor!, ']')) {
      return reuseOrCreateAfterAnchor(anchor)
    } else if (__DEV__) {
      throw new Error(
        `Failed to locate ${frag.anchorLabel} fragment anchor. this is likely a Vue internal bug.`,
      )
    }
  }
}

/** Rule 6: derive the anchor position from the hydrated block itself. */
function planFromBlockBoundary(frag: DynamicFragment): AnchorPlan {
  // Covers: dynamic component, async component, keyed fragment.
  const node = findBlockBoundary(frag.nodes)
  return { kind: 'create', parent: node.parentNode!, next: node.nextNode }
}

export function resolveDynamicAnchor(
  frag: DynamicFragment,
  isEmpty: boolean,
): AnchorPlan {
  return (
    planPendingSlotDecision(frag, isEmpty) ||
    planReuseInjectedAnchor(frag) ||
    (isEmpty ? planEmptyBranch(frag) : undefined) ||
    planRestartFromRuntimeComment(frag) ||
    planReuseBoundaryClose(frag) ||
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
      case 'pending': {
        const slotEnd = plan.slotEnd
        queuePendingSlotContentAnchor({
          onContent: () => {
            // Content won: claim the current SSR anchor candidate, or create a
            // fresh anchor after it if another fragment already claimed it.
            const node = currentHydrationNode
            const nodeParent = node && getParentNode(node)
            if (
              node &&
              nodeParent === plan.parent &&
              isReusableAnchorCandidate(node, frag)
            ) {
              if (isClaimedAnchor(node)) {
                const nextNode = node.nextSibling
                advanceHydrationNode(node)
                nodeParent.insertBefore(createRuntimeAnchor(), nextNode)
              } else {
                frag.anchor = claimAnchor(node)
                advanceHydrationNode(node)
              }
              return
            }
            // Mismatch recovery can leave the cursor on fallback DOM instead
            // of a reusable content anchor. Create this invalid branch's
            // runtime anchor before that DOM so later updates have a stable
            // insertion point.
            insertUntrackedAnchor(
              plan.parent,
              node && nodeParent === plan.parent ? node : slotEnd,
              createRuntimeAnchor(),
            )
          },
          onFallback: () => {
            // Match CSR by always creating the content fragment anchor, even
            // when fallback wins and keeps the anchor detached from the DOM.
            createRuntimeAnchor()
          },
        })
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
