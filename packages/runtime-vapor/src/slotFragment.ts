import { EffectScope } from '@vue/reactivity'
import {
  type Block,
  type TransitionOptions,
  insert,
  isValidSlot,
  remove,
} from './block'
import { isHydrating } from './dom/hydration'
import {
  type SlotBoundaryContext,
  hasSlotFallback,
  withSlotBoundary,
} from './slotBoundary'
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
): Block | undefined {
  let block: Block | undefined

  while (boundary) {
    const current = boundary
    const localFallback = current.getFallback()

    if (localFallback) {
      let selected = false
      const content = current.run(
        () =>
          withSlotBoundary(
            {
              ...current,
              // Hide the local fallback while rendering it, so slot outlets inside
              // the fallback don't resolve to the same fallback again.
              getFallback: () => undefined,
              onContentInvalid: [],
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
        return content
      }
      block = content
    }

    boundary = current.parent
  }

  return block
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
  pendingRecheckForce: boolean
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

// Entry point for validity-change notifications (boundary.markDirty). While
// user fallback code is rendering or the host is mid content update, the
// notification is folded into pendingRecheck instead of recursing: the
// in-flight operation ends with a recheck that subsumes it.
export function markSlotResolutionDirty(
  state: SlotResolutionState,
  force: boolean = false,
): void {
  if (state.isDisposed()) {
    return
  }
  if (state.isRenderingFallback || state.isBusy()) {
    state.pendingRecheck = true
    state.pendingRecheckForce = state.pendingRecheckForce || force
    return
  }
  recheckSlotResolution(state, force)
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
  if (isHydrating || !fallback || !isValidSlot(fallback)) {
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
  if (detachContent && !isHydrating) {
    const contentInvalidCallbacks = state.boundary.onContentInvalid
    if (contentInvalidCallbacks) {
      for (let i = 0; i < contentInvalidCallbacks.length; i++) {
        contentInvalidCallbacks[i]()
      }
    }
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
      const force = state.pendingRecheckForce
      state.pendingRecheck = false
      state.pendingRecheckForce = false
      recheckSlotResolution(state, force)
    }
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
  if (state.isRenderingFallback) {
    state.pendingRecheck = true
    state.pendingRecheckForce = state.pendingRecheckForce || force
    return
  }

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
