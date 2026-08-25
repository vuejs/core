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
import { IF, NATIVE_CHILDREN, SLOT } from '../fragmentFlags'

interface DeferredSlotAnchor {
  onContent: () => void
  onFallback: () => void
}

/*
 * ## Slot hydration session (two-phase commit)
 *
 * SSR output does not distinguish slot content from slot fallback, but
 * claiming server nodes is destructive (the cursor advances, anchors get
 * claimed). So while a slot is still deciding which side owns its SSR range,
 * anchor claims are *deferred* into a ledger and settled once the decision
 * lands. A session is that ledger plus the boundary's end anchor.
 *
 * Structure:
 * - One session per slot boundary, stacked for nesting
 *   (`currentSlotHydrationSession` is the top; the previous top is restored
 *   by the `with*` wrappers below).
 * - Within a session, `beginSegment` opens a nested pending window
 *   (LIFO, closed by the returned `finish(contentValid)`).
 * - `defer()` records an anchor claim in the innermost pending window;
 *   with no window open it refuses and the caller acts immediately.
 *
 * Settlement rules:
 * - Content proves valid → the *entire* ledger settles as content, outer
 *   segments included: once real content exists anywhere in the boundary,
 *   every deferred SSR candidate belongs to the content side.
 *   `markContentSettled()` (real DOM/text rendered — see `template()` and
 *   `createComponent`, the only two signal sources) does the same.
 * - Content proves invalid → only the innermost segment's entries roll back
 *   to their fallback action; entries deferred by outer segments stay pending
 *   for the outer decision. The cursor rewinds to the segment's start.
 * - A pending *boundary* that ends still undecided hands its ledger to the
 *   parent boundary (`adoptInto`), whose enclosing segment settles it.
 */
class SlotHydrationSession {
  private deferred: DeferredSlotAnchor[] | null = null

  constructor(
    readonly endAnchor: Node | null,
    public pending: boolean,
  ) {}

  /** Record a claim in the ledger; false = no pending window, act now. */
  defer(anchor: DeferredSlotAnchor): boolean {
    if (!this.pending) return false
    ;(this.deferred ||= []).push(anchor)
    return true
  }

  /**
   * Settle ledger entries. `from > 0` (only ever passed for an invalid
   * inner segment) rolls back just that segment's tail of the ledger.
   */
  private settle(contentValid: boolean, from = 0): void {
    const deferred = this.deferred
    if (!deferred) return
    const batch = from ? deferred.splice(from) : deferred
    if (!from) this.deferred = null
    for (let i = 0; i < batch.length; i++) {
      if (contentValid) {
        batch[i].onContent()
      } else {
        batch[i].onFallback()
      }
    }
  }

  /**
   * Open a pending window. The returned `finish` is idempotent and applies
   * the settlement rules above; on invalid content it also rewinds the
   * cursor to `start` so fallback hydrates the range content walked over.
   */
  beginSegment(start: Node | null): (contentValid: boolean) => void {
    const prevPending = this.pending
    const watermark = this.deferred ? this.deferred.length : 0
    this.pending = true
    let active = true
    return contentValid => {
      if (!active) return
      active = false
      this.settle(contentValid, !contentValid && prevPending ? watermark : 0)
      this.pending = prevPending
      if (!contentValid) {
        setCurrentHydrationNode(start)
      }
    }
  }

  /**
   * Unconditional variant for a child boundary that settled: the parent's
   * ledger settles as content even if the parent itself was not pending —
   * it may hold entries adopted from an earlier undecided child.
   */
  settleAsContent(): void {
    this.settle(true)
    this.pending = false
  }

  /** Boundary ended still undecided: its ledger becomes the parent's. */
  adoptInto(parent: SlotHydrationSession): void {
    if (this.deferred) {
      ;(parent.deferred ||= []).push(...this.deferred)
      this.deferred = null
    }
  }
}

let currentSlotHydrationSession: SlotHydrationSession | null = null

export function getCurrentSlotEndAnchor(): Node | null {
  return currentSlotHydrationSession
    ? currentSlotHydrationSession.endAnchor
    : null
}

/** Locate this boundary's SSR range and consume its opening marker. */
function enterSlotBoundaryRange(): {
  endAnchor: Node | null
  exitHydrationBoundary: (() => void) | undefined
} {
  let endAnchor = getCurrentSlotEndAnchor()
  let exitHydrationBoundary: (() => void) | undefined

  locateHydrationNode()
  if (isComment(currentHydrationNode!, '[')) {
    endAnchor = locateEndAnchor(currentHydrationNode)
    setCurrentHydrationNode(currentHydrationNode.nextSibling)
    exitHydrationBoundary = enterHydrationBoundary(endAnchor)
  }
  return { endAnchor, exitHydrationBoundary }
}

export function withHydratingSlotBoundary<R>(fn: () => R): R {
  const { endAnchor, exitHydrationBoundary } = enterSlotBoundaryRange()
  const prevSession = currentSlotHydrationSession
  currentSlotHydrationSession = new SlotHydrationSession(endAnchor, false)

  try {
    return fn()
  } finally {
    currentSlotHydrationSession = prevSession
    exitHydrationBoundary && exitHydrationBoundary()
  }
}

/**
 * A boundary that starts undecided (forwarded interop slots): if `fn`
 * completes without settling, the range stays unclaimed — the ledger is
 * adopted by the parent boundary and the cursor rewinds. If it settles,
 * the parent's own pending window settles as content along with it.
 */
export function withPendingHydratingSlotBoundary<R>(fn: () => R): R {
  const parentSession = currentSlotHydrationSession!
  const contentStart = currentHydrationNode
  const { endAnchor, exitHydrationBoundary } = enterSlotBoundaryRange()
  const session = new SlotHydrationSession(endAnchor, true)
  currentSlotHydrationSession = session
  let completed = false

  try {
    const result = fn()
    completed = true
    return result
  } finally {
    currentSlotHydrationSession = parentSession
    if (!completed) {
      exitHydrationBoundary && exitHydrationBoundary()
    } else if (session.pending) {
      session.adoptInto(parentSession)
      setCurrentHydrationNode(contentStart)
    } else {
      exitHydrationBoundary && exitHydrationBoundary()
      parentSession.settleAsContent()
    }
  }
}

export function queuePendingSlotContentAnchor(
  anchor: DeferredSlotAnchor,
): boolean {
  const session = currentSlotHydrationSession
  return !!session && session.defer(anchor)
}

// Slot content with fallback is unresolved until it creates a valid node.
// While unresolved, empty content branches must not consume fallback SSR
// anchors.
export function startPendingSlotContent(
  start: Node | null,
): (contentValid: boolean) => void {
  const session = currentSlotHydrationSession
  if (!session) return () => {}
  return session.beginSegment(start)
}

export function resolvePendingSlotContent(): void {
  const session = currentSlotHydrationSession
  if (session && session.pending) session.settleAsContent()
}

export function isPendingSlotContent(): boolean {
  const session = currentSlotHydrationSession
  return !!(session && session.pending)
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
    frag.__vf & NATIVE_CHILDREN &&
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
    !isComment(currentHydrationNode, ']')
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
