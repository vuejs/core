import { isArray } from '@vue/shared'
import { queuePostFlushCb } from '@vue/runtime-dom'
import {
  advanceHydrationNode,
  cleanupHydrationTail,
  currentHydrationNode,
  enterHydrationBoundary,
  isComment,
  isHydrationAnchor,
  isInDeferredHydrationBoundary,
  locateEndAnchor,
  locateHydrationBoundaryClose,
  locateHydrationNode,
  markHydrationAnchor,
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

function setCurrentHydratingSlotBoundaryState(
  state: HydratingSlotBoundaryState | null,
): HydratingSlotBoundaryState | null {
  try {
    return currentHydratingSlotBoundaryState
  } finally {
    currentHydratingSlotBoundaryState = state
  }
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
  const prevState = setCurrentHydratingSlotBoundaryState({
    endAnchor,
    pending: false,
    pendingAnchors: null,
  })

  try {
    return fn()
  } finally {
    setCurrentHydratingSlotBoundaryState(prevState)
    exitHydrationBoundary && exitHydrationBoundary()
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
): void {
  const state = currentHydratingSlotBoundaryState
  if (state && state.pending) {
    ;(state.pendingAnchors ||= []).push(anchor)
  }
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

function queueAnchorInsert(
  parentNode: Node,
  nextNode: Node | null,
  createAnchor: () => Node,
  fallbackNextNode?: Node | null,
): void {
  // Create the runtime anchor during the queued insertion so hydration
  // traversal never observes it before it is in its final position.
  queuePostFlushCb(() => {
    let anchor =
      nextNode && getParentNode(nextNode) === parentNode ? nextNode : null
    if (
      !anchor &&
      fallbackNextNode &&
      getParentNode(fallbackNextNode) === parentNode
    ) {
      anchor = fallbackNextNode
    }
    parentNode.insertBefore(createAnchor(), anchor)
  })
}

function isReusableAnchorCandidate(
  node: Node | null,
  anchorLabel?: string,
): node is Comment {
  return (
    !!node &&
    (isComment(node, '') ||
      isComment(node, ']') ||
      (anchorLabel !== undefined && isComment(node, anchorLabel)))
  )
}

function reuseOrCreateAfterAnchor(
  node: Node,
  resetNodes?: boolean,
): AnchorPlan {
  const parent = getParentNode(node)
  return isHydrationAnchor(node) && parent
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
    !frag.isSlot &&
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
      setCurrentHydrationNode(markHydrationAnchor(anchor))
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
  // Delay an empty slot-content anchor until content/fallback is decided.
  // If fallback wins, the content anchor is created detached.
  | {
      kind: 'pending'
      parent: Node
      slotEnd: Node
    }
  // Insert a fresh runtime anchor before `next` once insertion flushes.
  // `mark` keeps an SSR node structural so boundary cleanup preserves it.
  | {
      kind: 'create'
      parent: Node
      next: Node | null
      mark?: Node
      fallbackNext?: Node | null
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

export function resolveDynamicAnchor(
  frag: DynamicFragment,
  isEmpty: boolean,
): AnchorPlan {
  const anchorLabel = frag.anchorLabel
  const isNativeChildren = !!frag.nativeChildren
  // A fragment owns/manages its own dynamic anchor when it carries a label or
  // is a native-children fragment. Both branches are explicit so a future
  // truthiness check on the (possibly empty) label can't silently exclude one.
  const ownsDynamicAnchor = anchorLabel !== undefined || isNativeChildren

  // Native-children fragments get a runtime anchor injected by
  // createPlainElement when SSR rendered no default-slot content. Whenever the
  // cursor still points at that injected anchor — the branch stayed empty, or
  // it revived and hydrated its content ahead of the anchor — adopt it directly
  // instead of creating a second one.
  if (
    isNativeChildren &&
    isHydrationAnchor(currentHydrationNode) &&
    getParentNode(currentHydrationNode!)
  ) {
    return { kind: 'reuse', node: currentHydrationNode! }
  }

  // Empty fragments claim a current SSR anchor candidate directly. Later
  // fragments that need the same candidate create a fresh anchor after it.
  if (isEmpty) {
    if (isPendingSlotContent()) {
      const slotEnd = getCurrentSlotEndAnchor()!
      const node = currentHydrationNode || slotEnd
      return {
        kind: 'pending',
        parent: getParentNode(node)!,
        slotEnd,
      }
    }
    if (isReusableAnchorCandidate(currentHydrationNode)) {
      return reuseOrCreateAfterAnchor(currentHydrationNode)
    }
    if (
      anchorLabel &&
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
      !frag.isSlot &&
      ownsDynamicAnchor &&
      currentHydrationNode &&
      !isComment(currentHydrationNode, ']')
    ) {
      const parentNode = getParentNode(currentHydrationNode)
      // Empty branch against non-empty SSR output has no block node to
      // derive an insertion point from, so use the current hydration range.
      if (isNativeChildren && parentNode) {
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
        if (
          isReusableAnchorCandidate(anchor, anchorLabel) &&
          getParentNode(anchor)
        ) {
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

  // Reuse an existing SSR comment anchor for empty dynamic-component /
  // async-component / keyed-fragment branches. Without this, hydration can
  // end up creating a detached runtime anchor and lose the parent/sibling
  // position needed for same-hydration branch flips.
  if (
    ownsDynamicAnchor &&
    !isValidBlock(frag.nodes) &&
    frag.nodes instanceof Comment &&
    isReusableAnchorCandidate(frag.nodes, anchorLabel) &&
    getParentNode(frag.nodes)
  ) {
    return reuseOrCreateAfterAnchor(frag.nodes, true)
  }

  // Empty dynamic fragments can also start from a detached runtime comment
  // (for example client null against non-empty SSR content). In that case
  // derive the insertion point from the current hydration cursor rather
  // than from the detached block node, and let boundary cleanup trim the
  // SSR range before the next logical sibling.
  if (
    ownsDynamicAnchor &&
    !isValidBlock(frag.nodes) &&
    frag.nodes instanceof Comment &&
    !getParentNode(frag.nodes) &&
    currentHydrationNode
  ) {
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

  const currentSlotEndAnchor = getCurrentSlotEndAnchor()
  const slotAnchor = frag.isSlot ? currentSlotEndAnchor : null

  // SSR wraps slots and multi-root `v-if` branches with `<!--[-->...<!--]-->`.
  // The close marker is a valid stable anchor candidate: reuse it once, or
  // create a fresh runtime anchor after it when another fragment already did.
  if (
    frag.isSlot ||
    (anchorLabel === 'if' && isArray(frag.nodes) && frag.nodes.length > 1)
  ) {
    const anchor = locateHydrationBoundaryClose(
      slotAnchor || currentHydrationNode!,
      slotAnchor || null,
    )
    if (isComment(anchor!, ']')) {
      return reuseOrCreateAfterAnchor(anchor)
    } else if (__DEV__) {
      throw new Error(
        `Failed to locate ${anchorLabel} fragment anchor. this is likely a Vue internal bug.`,
      )
    }
  }

  // Otherwise, create a new anchor.
  // This covers: dynamic-component, async component, keyed fragment.
  const node = findBlockBoundary(frag.nodes)
  const parentNode = node.parentNode
  const nextNode = node.nextNode
  let fallbackNext: Node | null = null
  if (
    currentSlotEndAnchor &&
    nextNode === currentHydrationNode &&
    parentNode &&
    getParentNode(currentSlotEndAnchor) === parentNode
  ) {
    // `nextNode` can be stale fallback DOM that slot cleanup removes before the
    // queued anchor insertion flushes. Keep the anchor inside the slot range.
    fallbackNext = currentSlotEndAnchor
  }
  return { kind: 'create', parent: parentNode!, next: nextNode, fallbackNext }
}

export function executeAnchorPlan(
  frag: DynamicFragment,
  plan: AnchorPlan,
): void {
  let advanceAfterRestore: Node | null = null
  let exitHydrationBoundary: (() => void) | undefined

  const createRuntimeAnchor = (): Node =>
    (frag.anchor = markHydrationAnchor(
      __DEV__ ? createComment(frag.anchorLabel ?? '') : createTextNode(),
    ))

  try {
    switch (plan.kind) {
      case 'reuse': {
        if (plan.resetNodes) frag.nodes = EMPTY_BLOCK
        frag.anchor = markHydrationAnchor(plan.node)
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
              isReusableAnchorCandidate(node, frag.anchorLabel)
            ) {
              if (isHydrationAnchor(node)) {
                const nextNode = node.nextSibling
                advanceHydrationNode(node)
                nodeParent.insertBefore(createRuntimeAnchor(), nextNode)
              } else {
                frag.anchor = markHydrationAnchor(node)
                advanceHydrationNode(node)
              }
              return
            }
            // Mismatch recovery can leave the cursor on fallback DOM instead
            // of a reusable content anchor. Create this empty branch's
            // runtime anchor before that DOM so later updates have a stable
            // insertion point.
            const anchor = node && nodeParent === plan.parent ? node : slotEnd
            const parentNode = getParentNode(anchor)
            if (parentNode) {
              parentNode.insertBefore(createRuntimeAnchor(), anchor)
            }
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
        if (plan.mark) markHydrationAnchor(plan.mark)
        queueAnchorInsert(
          plan.parent,
          plan.next,
          createRuntimeAnchor,
          plan.fallbackNext,
        )
        break
      }
      case 'create-cleanup': {
        frag.nodes = EMPTY_BLOCK
        // The runtime anchor is inserted later. Until then, advance the cache
        // to the surviving next sibling, or clear it when cleanup reaches the tail.
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
        queueAnchorInsert(plan.parent, plan.next, createRuntimeAnchor)
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
