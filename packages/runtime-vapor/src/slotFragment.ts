import { EffectScope } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import {
  type Block,
  type TransitionOptions,
  insert,
  isValidBlock,
  remove,
  removeNode,
} from './block'
import { isVaporComponent } from './component'
import { isHydrating } from './dom/hydration'
import {
  type SlotBoundaryContext,
  hasSlotFallback,
  withSlotBoundary,
} from './slotBoundary'
import { SlotFragment } from './fragment'
import { applyTransitionHooks, isTransitionEnabled } from './transition'
import { setBlockKey } from './helpers/setKey'

// Slot resolution.
//
// Vapor has no component-level re-render: once slot content is rendered, the
// only signal that its *validity* changed (e.g. a root v-if inside the slot
// toggled) is a markDirty() notification delivered through the slot boundary
// chain (slotBoundary.ts). The functions below form a state machine that
// reacts to those notifications and decides which branch a slot exposes:
// the content while it is valid, otherwise the nearest valid fallback up the
// boundary chain.
//
// The machine is written against the duck-typed SlotResolutionState interface
// because it has three hosts: SlotFragment (vapor slots) and the two interop
// slot implementations in vdomInterop.ts, which keep their per-slot state in
// closures.

// View of a boundary used while rendering that boundary's own fallback. It
// masks the local fallback (getFallback -> undefined) so slot outlets
// *inside* the fallback body resolve against the parent chain instead of
// recursively landing on the very fallback being rendered, while keeping the
// owner's ambient slot / fragment context and dirty channel.
function getRedirectedBoundary(
  boundary: SlotBoundaryContext,
): SlotBoundaryContext {
  if (boundary.redirected) {
    return boundary.redirected
  }
  return (boundary.redirected = {
    parent: boundary.parent,
    getFallback: () => undefined,
    run: (fn, scope) => boundary.run(fn, scope),
    markDirty: () => boundary.markDirty(),
  })
}

// Walks the boundary chain outward and renders the nearest fallback into
// `scope`. Returns:
// - a valid block: the innermost fallback that rendered valid output;
// - an invalid block: every boundary providing a fallback rendered invalid
//   output (e.g. a fallback whose root v-if is currently false). The inherited
//   result wins when present; otherwise the local invalid block is kept. Their
//   effects stay live in the shared scope, so the chosen fallback can become
//   valid later;
// - undefined: no boundary in the chain provides a fallback at all.
function renderSlotFallback(
  boundary: SlotBoundaryContext | null,
  scope: EffectScope,
): Block | undefined {
  if (!boundary) {
    return undefined
  }

  const localFallback = boundary.getFallback()
  if (!localFallback) {
    return renderSlotFallback(boundary.parent, scope)
  }

  const renderFallback = () =>
    withSlotBoundary(getRedirectedBoundary(boundary), localFallback)
  const local = boundary.run(() => scope.run(renderFallback) || [], scope)
  if (isValidBlock(local)) {
    return local
  }

  const inherited = renderSlotFallback(boundary.parent, scope)
  return inherited === undefined ? local : inherited
}

// Per-slot state the slot resolution machine operates on. Implemented by
// SlotFragment and by the two interop slots in vdomInterop.ts.
export interface SlotResolutionState {
  // The slot's own resolution point; its parent chain supplies inherited
  // fallbacks for forwarded slots.
  boundary: SlotBoundaryContext
  // The committed fallback block, or null while content is exposed.
  activeFallback: Block | null
  // Detached scope owning the active fallback's effects (see
  // renderFallbackInScope); stopped by clearSlotFallback.
  fallbackScope?: EffectScope
  // Validity of the exposed branch as of the last recheck; undefined before
  // the first recheck. Flips trigger notifyExposedValidityChange.
  lastNodesValid?: boolean
  // A dirty notification arrived while a fallback render or a host update
  // was in flight; folded into the recheck that completes that operation.
  pendingRecheck: boolean
  // Reentrancy guard, set while renderSlotFallback runs user fallback code.
  isRenderingFallback: boolean

  getContent(): Block
  getParentNode(): ParentNode | null
  getAnchor(): Node | null
  // Whether the host is mid content update; rechecks must be deferred until
  // the update's own recheck runs.
  isBusy(): boolean
  isDisposed(): boolean
  isContentValid(): boolean
  // Points the host's exposed nodes at the winning branch
  // (activeFallback || content).
  syncNodes(): void
  // Reports an exposed-branch validity flip so an enclosing boundary can
  // recheck its own fallback decision.
  notifyExposedValidityChange(): void
}

// Takes a block's nodes out of the DOM without tearing the block down: no
// scopes are stopped and no remove() hooks run, so it can be re-inserted
// later (content parked while fallback shows, or an invalid fallback parked
// until it becomes valid). Fragment anchors are detached along with their
// block because the generic fragment insert() re-inserts them — except a
// SlotFragment's anchor: insertSlot() never re-inserts it and the slot
// locates itself through it (getParentNode/getAnchor), so it must stay in
// the DOM as the slot's persistent position marker.
function detachBlock(block: Block, parent: ParentNode): void {
  if (block instanceof Node) {
    if (block.parentNode === parent) {
      removeNode(block, parent)
    }
  } else if (isVaporComponent(block)) {
    if (block.block) {
      detachBlock(block.block, parent)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      detachBlock(block[i], parent)
    }
  } else {
    detachBlock(block.nodes, parent)
    if (
      !(block instanceof SlotFragment) &&
      block.anchor &&
      block.anchor.parentNode === parent
    ) {
      removeNode(block.anchor, parent)
    }
  }
}

// Entry point for validity-change notifications (boundary.markDirty). While
// user fallback code is rendering or the host is mid content update, the
// notification is folded into pendingRecheck instead of recursing: the
// in-flight operation ends with a recheck that subsumes it.
export function markSlotResolutionDirty(state: SlotResolutionState): void {
  if (state.isDisposed()) {
    return
  }
  if (state.isRenderingFallback || state.isBusy()) {
    state.pendingRecheck = true
    return
  }
  recheckSlotResolution(state, true)
}

function clearSlotFallback(state: SlotResolutionState): void {
  const fallback = state.activeFallback
  if (fallback) {
    const parentNode = state.getParentNode()
    if (parentNode) {
      remove(fallback, parentNode)
    }
    state.activeFallback = null
  }
  if (state.fallbackScope) {
    state.fallbackScope.stop()
    state.fallbackScope = undefined
  }
}

// Renders the fallback into a dedicated detached scope: the fallback must
// not die with whatever branch scope happens to be active when a recheck
// fires, so its lifetime is managed manually (stopped by clearSlotFallback,
// or right here when the render throws or yields nothing).
function renderFallbackInScope(
  state: SlotResolutionState,
): { block: Block; scope: EffectScope } | undefined {
  const scope = new EffectScope(true)
  let renderedFallback: Block | undefined
  state.isRenderingFallback = true
  try {
    renderedFallback = renderSlotFallback(state.boundary, scope)
  } catch (err) {
    scope.stop()
    throw err
  } finally {
    state.isRenderingFallback = false
  }

  if (!renderedFallback) {
    scope.stop()
    return undefined
  }

  return {
    block: renderedFallback,
    scope,
  }
}

export function insertActiveSlotFallback(state: SlotResolutionState): void {
  const fallback = state.activeFallback
  if (isHydrating || !fallback || !isValidBlock(fallback)) {
    return
  }
  const parentNode = state.getParentNode()
  if (!parentNode) {
    return
  }
  insert(fallback, parentNode, state.getAnchor())
}

// `detachContent` is true only on the first content -> fallback switch: the
// (invalid) content gets parked outside the DOM while staying alive. When
// replacing an already active fallback, the content is parked already.
function commitSlotFallback(
  state: SlotResolutionState,
  block: Block,
  scope: EffectScope,
  detachContent: boolean,
): void {
  const parentNode = state.getParentNode()
  if (detachContent && !isHydrating && parentNode) {
    detachBlock(state.getContent(), parentNode)
  }
  state.activeFallback = block
  state.fallbackScope = scope
  if (isTransitionEnabled) {
    const transitionState = state as SlotResolutionState & TransitionOptions
    if (transitionState.$transition) {
      // Match VDOM slot fallback branch identity so fallback enter does not
      // early-remove the currently leaving slot content.
      setBlockKey(block, '_fb')
      transitionState.$transition = applyTransitionHooks(
        block,
        transitionState.$transition,
      )
    }
  }
  insertActiveSlotFallback(state)
}

function renderAndCommitSlotFallback(
  state: SlotResolutionState,
  hadFallback: boolean,
): void {
  const result = renderFallbackInScope(state)
  clearSlotFallback(state)
  if (result) {
    commitSlotFallback(state, result.block, result.scope, !hadFallback)
    // drain notifications folded into this fallback render/update window
    if (state.pendingRecheck) {
      state.pendingRecheck = false
      recheckSlotResolution(state, true)
    }
  }
}

export function disposeSlotResolution(state: SlotResolutionState): void {
  clearSlotFallback(state)
  state.pendingRecheck = false
  state.lastNodesValid = undefined
}

// Reconciles which branch the slot exposes after something may have changed.
// `force` means a fallback source may differ from what the active fallback
// was rendered from (a boundary was dirtied, or the fallback prop changed),
// so a kept fallback must be re-rendered rather than merely re-inserted;
// without `force` only the insertion state is reconciled.
export function recheckSlotResolution(
  state: SlotResolutionState,
  force: boolean = false,
): void {
  if (state.isRenderingFallback) {
    state.pendingRecheck = true
    return
  }

  const fallback = state.activeFallback
  const fallbackValid = fallback ? isValidBlock(fallback) : false
  const contentValid = state.isContentValid()
  // Validity of the currently exposed branch (fallback if active, else content).
  const exposedValid = fallback ? fallbackValid : contentValid
  const prevNodesValid = state.lastNodesValid ?? exposedValid
  if (!force && contentValid && !fallback && prevNodesValid) {
    state.syncNodes()
    state.lastNodesValid = true
    return
  }

  // Content wins over fallback. If fallback was mounted, content may need to
  // be inserted back because it can be invalid while fallback is active.
  if (contentValid) {
    const content = state.getContent()
    const hadFallback = !!fallback
    clearSlotFallback(state)
    if (!isHydrating && hadFallback) {
      const parentNode = state.getParentNode()
      if (parentNode) {
        insert(content, parentNode, state.getAnchor())
      }
    }
  } else if (fallback) {
    // With an active fallback, `prevNodesValid` tells whether it could already
    // be in the DOM. Previously invalid fallback is inserted only after it
    // becomes valid.
    if (prevNodesValid) {
      if (!fallbackValid && !hasSlotFallback(state.boundary.parent)) {
        // No parent fallback can replace it, so invalid fallback leaves the
        // slot empty.
        const parentNode = state.getParentNode()
        if (parentNode) {
          detachBlock(fallback, parentNode)
        }
      } else if (force) {
        renderAndCommitSlotFallback(state, true)
      }
    } else if (fallbackValid) {
      insertActiveSlotFallback(state)
    } else if (force) {
      renderAndCommitSlotFallback(state, true)
    }
  } else {
    renderAndCommitSlotFallback(state, false)
  }

  const nextFallback = state.activeFallback
  const nextNodesValid =
    contentValid && !nextFallback
      ? true
      : nextFallback
        ? isValidBlock(nextFallback)
        : state.isContentValid()
  state.syncNodes()
  state.lastNodesValid = nextNodesValid
  if (prevNodesValid !== nextNodesValid) {
    state.notifyExposedValidityChange()
  }
}
