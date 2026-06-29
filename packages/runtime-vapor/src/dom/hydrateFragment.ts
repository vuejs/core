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
} from './node'
import {
  type Block,
  EMPTY_BLOCK,
  findBlockBoundary,
  isValidBlock,
} from '../block'
import { type DynamicFragment, isSlotFragment } from '../fragment'

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
): void {
  // Empty fragments rendered before the slot decision cannot know whether
  // their anchor belongs to content SSR or needs to be created for fallback.
  const pendingAnchors = state.pendingAnchors
  if (!pendingAnchors) return
  state.pendingAnchors = null
  for (let i = 0; i < pendingAnchors.length; i++) {
    const pendingAnchor = pendingAnchors[i]
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
  state.pending = true
  let active = true
  return contentValid => {
    if (!active) return
    active = false
    resolvePendingSlotContentAnchors(state, contentValid)
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

const enum CloseAnchorOwner {
  None,
  Self,
  ParentBefore,
  ParentAfter,
}

function getDynamicCloseOwner(
  isSlot: boolean,
  forwardedSlot: boolean,
  anchorLabel: string | undefined,
  nodes: Block,
  currentSlotEndAnchor: Node | null,
): CloseAnchorOwner {
  // Slot fragments own the close marker unless this is an empty forwarded slot.
  // Empty forwarded slots must leave the close marker to the parent boundary
  // and create their runtime anchor after it.
  if (isSlot) {
    if (!forwardedSlot) return CloseAnchorOwner.Self
    return isValidBlock(nodes)
      ? CloseAnchorOwner.Self
      : CloseAnchorOwner.ParentAfter
  }

  // SSR wraps multi-root `v-if` branches in a fragment range, so the closing
  // `<!--]-->` belongs to the branch itself.
  if (anchorLabel === 'if' && isArray(nodes) && nodes.length > 1) {
    return CloseAnchorOwner.Self
  }

  return CloseAnchorOwner.None
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

function isReusableDynamicFragmentAnchor(
  node: Comment,
  anchorLabel: string,
): boolean {
  return (
    isComment(node, anchorLabel) ||
    (isComment(node, '') &&
      (anchorLabel === 'dynamic-component' ||
        anchorLabel === 'async component' ||
        anchorLabel === 'keyed'))
  )
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
  // Adopt an existing SSR comment node as the fragment anchor.
  | { kind: 'reuse'; node: Node; resetNodes?: boolean }
  // Delay an empty slot-content anchor until content/fallback ownership is
  // known. Fallback-owned content anchors are inserted before the slot end.
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
  // Insert a fresh runtime anchor right before the enclosing slot end anchor,
  // skipping insertion entirely if that anchor leaves the DOM before flush.
  | { kind: 'create-before-slot-end'; end: Node }

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

  // reuse `<!---->` as anchor
  // `<div v-if="false"></div>` -> `<!---->`
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
    if (currentHydrationNode && isComment(currentHydrationNode, '')) {
      return { kind: 'reuse', node: currentHydrationNode }
    }
    if (
      frag.anchorLabel &&
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

      const anchor = nextLogicalSibling(currentHydrationNode)
      const reusableAnchor =
        anchor &&
        anchor.nodeType === 8 &&
        isReusableDynamicFragmentAnchor(anchor as Comment, anchorLabel!) &&
        getParentNode(anchor)
          ? anchor
          : null
      if (parentNode) {
        if (reusableAnchor) {
          return { kind: 'reuse', node: reusableAnchor, resetNodes: true }
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
    isReusableDynamicFragmentAnchor(frag.nodes, anchorLabel!) &&
    getParentNode(frag.nodes)
  ) {
    return { kind: 'reuse', node: frag.nodes, resetNodes: true }
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
  const forwardedSlot = isSlotFragment(frag) ? frag.forwarded : false
  const slotAnchor = frag.isSlot ? currentSlotEndAnchor : null

  // Reuse SSR `<!--]-->` as anchor.
  // SSR wraps slots and multi-root `v-if` branches with `<!--[-->...<!--]-->`.
  // Non-forwarded slots always own the closing `<!--]-->`, even when empty.
  // Forwarded slots only own it when they rendered valid content.
  const closeOwner = getDynamicCloseOwner(
    !!frag.isSlot,
    forwardedSlot,
    frag.anchorLabel,
    frag.nodes,
    currentSlotEndAnchor,
  )
  if (closeOwner === CloseAnchorOwner.Self) {
    const anchor = locateHydrationBoundaryClose(
      slotAnchor || currentHydrationNode!,
      slotAnchor || null,
    )
    if (isComment(anchor!, ']')) {
      return { kind: 'reuse', node: anchor }
    } else if (__DEV__) {
      throw new Error(
        `Failed to locate ${frag.anchorLabel} fragment anchor. this is likely a Vue internal bug.`,
      )
    }
  } else if (
    closeOwner === CloseAnchorOwner.ParentAfter &&
    currentSlotEndAnchor
  ) {
    // Otherwise, create a new anchor.
    // This covers: empty forwarded slots.
    // Keep the forwarded slot close marker structural for parent cleanup,
    // even though this fragment uses a runtime anchor after it.
    return {
      kind: 'create',
      parent: currentSlotEndAnchor.parentNode!,
      next: currentSlotEndAnchor.nextSibling,
      mark: currentSlotEndAnchor,
    }
  } else if (
    closeOwner === CloseAnchorOwner.ParentBefore &&
    currentSlotEndAnchor
  ) {
    return { kind: 'create-before-slot-end', end: currentSlotEndAnchor }
  }

  // Otherwise, create a new anchor.
  // This covers: dynamic-component, async component, keyed fragment.
  let parentNode: Node | null
  let nextNode: Node | null
  if (
    frag.anchorLabel === 'if' &&
    !isValidBlock(frag.nodes) &&
    currentSlotEndAnchor &&
    currentHydrationNode === currentSlotEndAnchor
  ) {
    // Only reuse the slot end anchor as insertion point when this empty
    // inner `v-if` has already consumed the whole local slot range.
    parentNode = currentSlotEndAnchor.parentNode
    nextNode = currentSlotEndAnchor
  } else {
    const node = findBlockBoundary(frag.nodes)
    parentNode = node.parentNode
    nextNode = node.nextNode
  }
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
            // Content won: adopt the pending SSR anchor for this empty
            // fragment and advance past it before hydrating following content.
            const node = currentHydrationNode
            const nodeParent = node && getParentNode(node)
            if (
              node &&
              nodeParent === plan.parent &&
              node.nodeType === 8 &&
              (isComment(node, '') ||
                (frag.anchorLabel !== undefined &&
                  isReusableDynamicFragmentAnchor(
                    node as Comment,
                    frag.anchorLabel,
                  )))
            ) {
              frag.anchor = markHydrationAnchor(node)
              advanceHydrationNode(node)
            } else {
              // Mismatch recovery can leave the cursor on fallback DOM instead
              // of a reusable content anchor. Create this empty branch's
              // runtime anchor before that DOM so later updates have a stable
              // insertion point.
              const anchor = node && nodeParent === plan.parent ? node : slotEnd
              const parentNode = getParentNode(anchor)
              if (parentNode) {
                parentNode.insertBefore(createRuntimeAnchor(), anchor)
              }
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
        if (plan.cleanupUntil) {
          exitHydrationBoundary = enterHydrationBoundary(plan.cleanupUntil)
        } else {
          cleanupHydrationTail(plan.cleanupStart, plan.cleanupContainer)
          setCurrentHydrationNode(null)
        }
        queueAnchorInsert(plan.parent, plan.next, createRuntimeAnchor)
        break
      }
      case 'create-before-slot-end': {
        const endAnchor = plan.end
        queuePostFlushCb(() => {
          const parentNode = getParentNode(endAnchor)
          if (!parentNode) return
          parentNode.insertBefore(createRuntimeAnchor(), endAnchor)
        })
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
