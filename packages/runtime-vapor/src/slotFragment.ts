import { EffectScope } from '@vue/reactivity'
import {
  type Block,
  type VaporTransitionHooks,
  insert,
  isValidSlot,
  remove,
  removeAttachedNodes,
} from './block'
import { isHydrating } from './dom/hydration'
import {
  type SlotBoundaryContext,
  hasSlotFallback,
  withSlotBoundary,
} from './slotBoundary'
import {
  applyTransitionHooks,
  applyTransitionLeaveHooks,
  isTransitionEnabled,
} from './transition'
import { setBlockKey } from './helpers/setKey'
import type { VaporFragment } from './fragment'

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

interface RenderedSlotFallback {
  block: Block
  onContentInvalid: (() => void)[]
}

// Walks the boundary chain outward and renders fallbacks into `scope`. Returns:
// - a valid block: the innermost fallback that rendered valid output;
// - an invalid block: every boundary providing a fallback rendered invalid
//   output (e.g. a fallback whose root v-if is currently false). The outermost
//   invalid result is kept. Their effects stay live in the shared scope, so a
//   fallback can become valid later;
// - undefined: no boundary in the chain provides a fallback at all.
function renderSlotFallback(
  boundary: SlotBoundaryContext | null,
  scope: EffectScope,
): RenderedSlotFallback | undefined {
  let result: RenderedSlotFallback | undefined

  while (boundary) {
    const current = boundary
    const localFallback = current.getFallback()

    if (localFallback) {
      let selected = false
      const onContentInvalid: (() => void)[] = []
      const content = current.run(
        () =>
          withSlotBoundary(
            {
              ...current,
              // Hide the local fallback while rendering it, so slot outlets inside
              // the fallback don't resolve to the same fallback again.
              getFallback: () => undefined,
              onContentInvalid,
              // Hidden invalid fallbacks in a forwarded fallback chain must
              // force a recheck when they become valid so the nearer fallback
              // can win again. The selected fallback only needs a normal
              // validity recheck because its own dynamic children update in
              // place.
              markDirty: force =>
                current.markDirty(
                  !!force || (!selected && hasSlotFallback(current.parent)),
                ),
            },
            localFallback,
          ),
        scope,
      )
      if (isValidSlot(content)) {
        selected = true
        return { block: content, onContentInvalid }
      }
      result = { block: content, onContentInvalid }
    }

    boundary = current.parent
  }

  return result
}

// Per-slot state the slot resolution machine operates on. Implemented by
// SlotFragment and by the two interop slots in vdomInterop.ts.
export interface SlotResolutionState {
  // The slot's own resolution point; its parent chain supplies inherited
  // fallbacks for forwarded slots.
  boundary: SlotBoundaryContext
  // The committed fallback block, or null while content is exposed.
  activeFallback: Block | null
  // Parking callbacks registered by hosts rendered in the active fallback.
  activeFallbackInvalidCallbacks?: (() => void)[]
  // A committed fallback can be invalid and therefore remain detached.
  fallbackInserted: boolean
  // Detached scope owning the active fallback's effects (see
  // renderFallbackInScope); stopped by clearSlotFallback.
  fallbackScope?: EffectScope
  // Validity of the exposed branch as of the last recheck; undefined before
  // the first recheck. Flips trigger notifyExposedValidityChange.
  lastNodesValid?: boolean
  // A dirty notification arrived during reconciliation or a host update;
  // folded into the recheck that completes that operation.
  pendingRecheck: boolean
  pendingRecheckForce: boolean
  // Reentrancy guard for one atomic content/fallback reconciliation.
  isReconciling: boolean
  $transition?: VaporTransitionHooks
  applyScopeId?: (block: Block) => void
  scopeIdFragment?: VaporFragment

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

// Publishes the winning branch to the host's exposed nodes, then runs the
// host fragment's scopeId preparation on the just-materialized block so it is
// ready before it can reach the DOM. The interop hosts keep their state
// separate from the fragment and point back to it via scopeIdFragment;
// SlotFragment is its own fragment.
export function syncNodesAndApplyScopeId(
  state: SlotResolutionState,
  block: Block,
): void {
  state.syncNodes()
  const host = state.scopeIdFragment || state
  if (host.applyScopeId) {
    host.applyScopeId(block)
  }
}

// Entry point for validity-change notifications (boundary.markDirty). During
// reconciliation or a host content update, fold notifications into the
// in-flight operation instead of recursing.
export function markSlotResolutionDirty(
  state: SlotResolutionState,
  force: boolean = false,
): void {
  if (state.isDisposed()) {
    return
  }
  if (state.isReconciling || state.isBusy()) {
    state.pendingRecheck = true
    state.pendingRecheckForce = state.pendingRecheckForce || force
    return
  }
  recheckSlotResolution(state, force)
}

export function invalidateExposedSlotContent(state: SlotResolutionState): void {
  const callbacks = state.activeFallback
    ? state.activeFallbackInvalidCallbacks
    : state.boundary.onContentInvalid
  if (callbacks) {
    for (let i = 0; i < callbacks.length; i++) {
      callbacks[i]()
    }
  }
}

function clearSlotFallback(state: SlotResolutionState): void {
  const fallback = state.activeFallback
  if (fallback) {
    const parentNode = state.getParentNode()
    if (state.fallbackInserted && parentNode) {
      remove(fallback, parentNode)
    }
    state.activeFallback = null
    state.fallbackInserted = false
  }
  state.activeFallbackInvalidCallbacks = undefined
  if (state.fallbackScope) {
    state.fallbackScope.stop()
    state.fallbackScope = undefined
  }
}

export function leaveSlotFallback(
  state: SlotResolutionState,
  hooks: VaporTransitionHooks,
  afterLeave: () => void,
): boolean {
  const fallback = state.activeFallback
  if (!fallback || !applyTransitionLeaveHooks(fallback, hooks, afterLeave)) {
    return false
  }
  clearSlotFallback(state)
  return true
}

// Renders the fallback into a dedicated detached scope: the fallback must
// not die with whatever branch scope happens to be active when a recheck
// fires, so its lifetime is managed manually (stopped by clearSlotFallback,
// or right here when the render throws or yields nothing).
function renderFallbackInScope(
  state: SlotResolutionState,
): (RenderedSlotFallback & { scope: EffectScope }) | undefined {
  const scope = new EffectScope(true)
  let renderedFallback: RenderedSlotFallback | undefined
  try {
    renderedFallback = renderSlotFallback(state.boundary, scope)
  } catch (err) {
    scope.stop()
    throw err
  }

  if (!renderedFallback) {
    scope.stop()
    return undefined
  }

  return {
    block: renderedFallback.block,
    onContentInvalid: renderedFallback.onContentInvalid,
    scope,
  }
}

export function insertActiveSlotFallback(state: SlotResolutionState): void {
  const fallback = state.activeFallback
  if (isHydrating || !fallback || !isValidSlot(fallback)) {
    return
  }
  const parentNode = state.getParentNode()
  if (!parentNode) {
    return
  }
  insert(fallback, parentNode, state.getAnchor())
  state.fallbackInserted = true
}

// `detachContent` is true only on the first content -> fallback switch: the
// (invalid) content gets parked outside the DOM while staying alive. When
// replacing an already active fallback, the content is parked already.
function commitSlotFallback(
  state: SlotResolutionState,
  block: Block,
  scope: EffectScope,
  onContentInvalid: (() => void)[],
  detachContent: boolean,
): void {
  state.activeFallback = block
  state.activeFallbackInvalidCallbacks = onContentInvalid
  state.fallbackScope = scope
  state.fallbackInserted = isHydrating
  syncNodesAndApplyScopeId(state, block)
  if (isTransitionEnabled) {
    if (state.$transition) {
      // Match VDOM slot fallback branch identity so fallback enter does not
      // early-remove the currently leaving slot content.
      setBlockKey(block, '_fb')
      state.$transition = applyTransitionHooks(block, state.$transition)
    }
  }
  if (detachContent && !isHydrating) {
    const parentNode = state.getParentNode()
    const contentInvalidCallbacks = state.boundary.onContentInvalid
    if (contentInvalidCallbacks)
      for (let i = 0; i < contentInvalidCallbacks.length; i++)
        contentInvalidCallbacks[i]()
    if (parentNode) {
      removeAttachedNodes(state.getContent(), parentNode, false)
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
    commitSlotFallback(
      state,
      result.block,
      result.scope,
      result.onContentInvalid,
      !hadFallback,
    )
  }
}

export function disposeSlotResolution(state: SlotResolutionState): void {
  clearSlotFallback(state)
  state.pendingRecheck = false
  state.pendingRecheckForce = false
  state.lastNodesValid = undefined
}

// Reconciles which branch the slot exposes after something may have changed.
// `force` means the fallback chain may now resolve to a different block (the
// fallback source changed, or a hidden fallback became valid), so a kept valid
// fallback must be re-rendered. Ordinary dirty notifications from the selected
// fallback's own dynamic children are not forced; those children update in
// place.
export function recheckSlotResolution(
  state: SlotResolutionState,
  force: boolean = false,
): void {
  if (state.isReconciling) {
    state.pendingRecheck = true
    state.pendingRecheckForce = state.pendingRecheckForce || force
    return
  }

  let nextForce = force || state.pendingRecheckForce
  do {
    state.pendingRecheck = false
    state.pendingRecheckForce = false
    state.isReconciling = true
    try {
      recheckSlotResolutionNow(state, nextForce)
    } finally {
      state.isReconciling = false
    }
    if (!state.pendingRecheck) return
    nextForce = state.pendingRecheckForce
  } while (true)
}

function recheckSlotResolutionNow(
  state: SlotResolutionState,
  force: boolean,
): void {
  const fallback = state.activeFallback
  const fallbackValid = fallback ? isValidSlot(fallback) : false
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
    syncNodesAndApplyScopeId(state, content)
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
      // If the selected fallback becomes invalid and no inherited fallback can
      // take over, keep it active. This is an internal fallback update, so its
      // anchors/effects must stay live until it becomes valid again.
      if (!fallbackValid && hasSlotFallback(state.boundary.parent)) {
        renderAndCommitSlotFallback(state, true)
      } else if (force && fallbackValid) {
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
        ? nextFallback === fallback
          ? fallbackValid
          : isValidSlot(nextFallback)
        : state.isContentValid()
  state.syncNodes()
  state.lastNodesValid = nextNodesValid
  if (prevNodesValid !== nextNodesValid) {
    state.notifyExposedValidityChange()
  }
}
