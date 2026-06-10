import { isArray } from '@vue/shared'
import { queuePostFlushCb } from '@vue/runtime-dom'
import {
  advanceHydrationNode,
  cleanupHydrationTail,
  currentHydrationNode,
  enterHydrationBoundary,
  isComment,
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
  fallbackActive: boolean
}

let currentHydratingSlotBoundaryState: HydratingSlotBoundaryState | null = null

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
    fallbackActive: false,
  })

  try {
    return fn()
  } finally {
    setCurrentHydratingSlotBoundaryState(prevState)
    exitHydrationBoundary && exitHydrationBoundary()
  }
}

// Tracks hydration while a slot boundary is resolving fallback through inner
// empty control-flow fragments, e.g.
// - `<slot><template v-if="false" /></slot>`
// - `<slot><span v-for="item in items" /></slot>`.
// We need a boundary-level marker because the inner empty fragment can hydrate
// before slot render finishes deciding whether fallback will take over. While
// active, empty inner fragments should create their own runtime anchor instead
// of assuming SSR already provided the final insertion point.
export function isHydratingSlotFallbackActive(): boolean {
  return !!(
    currentHydratingSlotBoundaryState &&
    currentHydratingSlotBoundaryState.fallbackActive
  )
}

export function setCurrentHydratingSlotFallbackActive(
  active: boolean,
): boolean {
  try {
    return isHydratingSlotFallbackActive()
  } finally {
    if (currentHydratingSlotBoundaryState) {
      currentHydratingSlotBoundaryState.fallbackActive = active
    }
  }
}

export function withHydratingSlotFallbackActive<R>(fn: () => R): R {
  const prevState = setCurrentHydratingSlotFallbackActive(true)
  try {
    return fn()
  } finally {
    setCurrentHydratingSlotFallbackActive(prevState)
  }
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

  // Slot fallback can fall through an inner `v-if`. When the `if` resolves
  // to an invalid block and the fallback is selected, the `if` still needs
  // its own runtime anchor instead of reusing the parent slot's end anchor.
  if (
    anchorLabel === 'if' &&
    currentSlotEndAnchor &&
    isHydratingSlotFallbackActive() &&
    !isValidBlock(nodes)
  ) {
    return CloseAnchorOwner.ParentBefore
  }

  return CloseAnchorOwner.None
}

function queueAnchorInsert(
  parentNode: Node,
  nextNode: Node | null,
  createAnchor: () => Node,
): void {
  // Create the runtime anchor only after insertion is flushed so traversal
  // cannot observe a detached anchor too early.
  queuePostFlushCb(() => {
    const anchor =
      nextNode && getParentNode(nextNode) === parentNode ? nextNode : null
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
  // Insert a fresh runtime anchor before `next` once insertion flushes.
  // `mark` keeps an SSR node structural so boundary cleanup preserves it.
  | { kind: 'create'; parent: Node; next: Node | null; mark?: Node }
  // Trim unclaimed SSR content first, then insert a fresh runtime anchor.
  // Only arises for empty fragments, so the stale block reference is cleared.
  | {
      kind: 'create-cleanup'
      parent: Node
      next: Node | null
      cleanupStart: Node
      cleanupUntil: Node | null
    }
  // Insert a fresh runtime anchor right before the enclosing slot end anchor,
  // skipping insertion entirely if that anchor leaves the DOM before flush.
  | { kind: 'create-before-slot-end'; end: Node }

export function resolveDynamicAnchor(
  frag: DynamicFragment,
  isEmpty: boolean,
): AnchorPlan {
  // reuse `<!---->` as anchor
  // `<div v-if="false"></div>` -> `<!---->`
  if (isEmpty) {
    if (isComment(currentHydrationNode!, '')) {
      return { kind: 'reuse', node: currentHydrationNode! }
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
      frag.anchorLabel &&
      currentHydrationNode &&
      !isHydratingSlotFallbackActive() &&
      !isComment(currentHydrationNode, ']')
    ) {
      const parentNode = getParentNode(currentHydrationNode)
      const anchor = nextLogicalSibling(currentHydrationNode)
      // Empty branch against non-empty SSR output has no block node to
      // derive an insertion point from, so use the current hydration range.
      const reusableAnchor =
        anchor &&
        anchor.nodeType === 8 &&
        isReusableDynamicFragmentAnchor(anchor as Comment, frag.anchorLabel) &&
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
    frag.anchorLabel &&
    !isValidBlock(frag.nodes) &&
    frag.nodes instanceof Comment &&
    isReusableDynamicFragmentAnchor(frag.nodes, frag.anchorLabel) &&
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
    frag.anchorLabel &&
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
  return { kind: 'create', parent: parentNode!, next: nextNode }
}

export function executeAnchorPlan(
  frag: DynamicFragment,
  plan: AnchorPlan,
): void {
  let advanceAfterRestore: Node | null = null
  let exitHydrationBoundary: (() => void) | undefined

  const createRuntimeAnchor = (): Node =>
    (frag.anchor = markHydrationAnchor(
      __DEV__ ? createComment(frag.anchorLabel!) : createTextNode(),
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
      case 'create': {
        if (plan.mark) markHydrationAnchor(plan.mark)
        queueAnchorInsert(plan.parent, plan.next, createRuntimeAnchor)
        break
      }
      case 'create-cleanup': {
        frag.nodes = EMPTY_BLOCK
        if (plan.cleanupUntil) {
          exitHydrationBoundary = enterHydrationBoundary(plan.cleanupUntil)
        } else {
          cleanupHydrationTail(plan.cleanupStart)
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
