import { EffectScope } from '@vue/reactivity'
import { extend, isArray } from '@vue/shared'
import type { MoveType } from '@vue/runtime-dom'
import {
  type Block,
  type VaporTransitionHooks,
  insert,
  isValidSlot,
  move,
  remove,
  removeAttachedNodes,
} from './block'
import { isHydrating, isHydratingSlotFallback } from './dom/hydration'
import { renderWithSlotScopeIds } from './scopeId'
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
import { type VaporFragment, isFragment, isInteropFragment } from './fragment'
import { isInteropEnabled } from './vdomInteropState'

// Slot resolution.
//
// Vapor has no component-level re-render: once slot content is rendered, the
// only signal that its *validity* changed (e.g. a root v-if inside the slot
// toggled) is a markDirty() notification delivered through the slot boundary
// (slotBoundary.ts). The functions below form a state machine that reacts to
// those notifications and decides which branch a slot host exposes: the
// content while it is valid, otherwise the nearest valid fallback the host
// provides.
//
// Every fallback is rendered by the host providing it. A forwarded outlet
// never renders an enclosing outlet's fallback: it exposes the validity of
// its own branch, and the enclosing outlet treats it as plain content, so
// nearest-wins is the cascade of those decisions. `boundary.getParent()`
// enumerates the further fallbacks a host provides itself (slotBoundary.ts).
//
// The machine is written against the duck-typed SlotResolutionState interface
// because it has three hosts: SlotFragment (vapor slots) and the two interop
// slot implementations in vdomInterop.ts, which keep their per-slot state in
// closures.

export interface RenderedSlotFallback {
  block: Block
  boundary: SlotBoundaryContext
  // Parking callbacks registered by hosts rendered in the fallback body.
  onContentInvalid: (() => void)[]
  // hydration: adopted where the server rendered it
  adopted: boolean
}

const noFallback = (): undefined => undefined

// Walks the host's fallback providers outward and renders their fallbacks
// into `scope`, stopping at the first valid one. Every rendered fallback
// stays alive: an invalid one can become valid later and then takes over.
function renderSlotFallbacks(
  boundary: SlotBoundaryContext | null,
  scope: EffectScope,
): RenderedSlotFallback[] {
  const rendered: RenderedSlotFallback[] = []

  while (boundary) {
    const render = boundary.getFallback()

    if (render) {
      // the PROVIDING outlet's ids, none included: as in vdom, an outer
      // outlet's fallback replaces the forwarded content and the slotted ids
      // around it
      const getScopeIds = boundary.getScopeIds
      const renderBody = getScopeIds
        ? () => renderWithSlotScopeIds(getScopeIds(), render)
        : render
      const adopt = isHydratingSlotFallback && boundary.adoptFallback
      if (adopt) boundary.adoptFallback = undefined
      const onContentInvalid: (() => void)[] = []
      // The body sees no provider of its own: an outlet inside it exposes its
      // invalidity to the host instead of resolving the same fallback again.
      const body = extend({}, boundary, {
        getFallback: noFallback,
        onContentInvalid,
      })
      const block = boundary.run(
        () =>
          withSlotBoundary(body, adopt ? () => adopt(renderBody) : renderBody),
        scope,
      )
      rendered.push({ block, boundary, onContentInvalid, adopted: !!adopt })
      if (isValidSlot(block)) break
    }

    boundary = boundary.getParent()
  }

  return rendered
}

// Per-slot state the slot resolution machine operates on. Implemented by
// SlotFragment and by the two interop slots in vdomInterop.ts.
export interface SlotResolutionState {
  // The slot's own resolution point; its parent chain supplies the further
  // fallbacks the host provides.
  boundary: SlotBoundaryContext
  // The committed fallback block, or null while content is exposed.
  activeFallback: Block | null
  // Every fallback rendered on the way to the active one, nearest first; the
  // active one is the last.
  renderedFallbacks?: RenderedSlotFallback[]
  // A committed fallback can be invalid and therefore remain detached.
  fallbackInserted: boolean
  // Detached scope owning the rendered fallbacks' effects (see
  // renderAndCommitSlotFallback); stopped with the outlet or by
  // clearSlotFallback.
  fallbackScope?: EffectScope
  // Set by an interop host when its providers changed (a vdom outlet
  // forwarding the slot joined or left); see isSlotFallbackChainStale.
  fallbackChainStale?: boolean
  // Validity of the exposed branch as of the last recheck; undefined before
  // the first recheck. Flips trigger notifyExposedValidityChange.
  lastNodesValid?: boolean
  // A dirty notification arrived during reconciliation or a host update;
  // folded into the recheck that completes that operation.
  pendingRecheck: boolean
  // Reentrancy guard for one atomic content/fallback reconciliation.
  isReconciling: boolean
  $transition?: VaporTransitionHooks

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
  // beforeMount hooks, handed every block about to be exposed
  bm?: ((nodes: Block) => void)[]
}

function beforeExpose(state: SlotResolutionState, block: Block): void {
  const bm = state.bm
  if (bm) {
    for (let i = 0; i < bm.length; i++) bm[i](block)
  }
}

/**
 * The winning exposed branch for a slot host: the committed fallback while one
 * is active, the resolved content otherwise. Every host's `syncNodes` points
 * its exposed nodes here.
 */
export function resolveExposedSlotNodes(state: SlotResolutionState): Block {
  return state.activeFallback || state.getContent()
}

// Entry point for validity-change notifications (boundary.markDirty). During
// reconciliation or a host content update, fold notifications into the
// in-flight operation instead of recursing.
export function markSlotResolutionDirty(state: SlotResolutionState): void {
  if (state.isDisposed()) {
    return
  }
  if (state.isReconciling || state.isBusy()) {
    state.pendingRecheck = true
    return
  }
  recheckSlotResolution(state)
}

export function invalidateExposedSlotContent(state: SlotResolutionState): void {
  const rendered = state.renderedFallbacks
  const callbacks = rendered
    ? rendered[rendered.length - 1].onContentInvalid
    : state.boundary.onContentInvalid
  if (callbacks) {
    for (let i = 0; i < callbacks.length; i++) {
      callbacks[i]()
    }
  }
}

function clearSlotFallback(
  state: SlotResolutionState,
  parentNode: ParentNode | null = state.getParentNode(),
): void {
  if (state.fallbackScope) {
    state.fallbackScope.stop()
    state.fallbackScope = undefined
  }
  const fallback = state.activeFallback
  if (fallback) {
    remove(
      fallback,
      state.fallbackInserted ? parentNode || undefined : undefined,
    )
    state.activeFallback = null
    state.fallbackInserted = false
  }
  state.renderedFallbacks = undefined
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

// hydration, behind `isHydratingSlotFallback`: the fallback adopted from the server is
// in the DOM already and stays where the server put it. A vdom one keeps its
// own record of where that is.
export function placeAdoptedFallback(
  state: SlotResolutionState,
  parentNode: ParentNode,
  anchor: Node | null,
): boolean {
  if (!state.fallbackInserted) return false
  const fallback = state.activeFallback
  if (isInteropEnabled && isInteropFragment(fallback)) {
    fallback.insert!(parentNode, anchor)
  }
  return true
}

export function insertActiveSlotFallback(
  state: SlotResolutionState,
  moveType?: MoveType,
): void {
  const fallback = state.activeFallback
  if (isHydrating || !fallback || !isValidSlot(fallback)) {
    return
  }
  const parentNode = state.getParentNode()
  if (
    !parentNode ||
    (isHydratingSlotFallback &&
      placeAdoptedFallback(state, parentNode, state.getAnchor()))
  ) {
    return
  }
  if (moveType === undefined) {
    insert(fallback, parentNode, state.getAnchor())
  } else {
    move(fallback, parentNode, state.getAnchor(), moveType)
  }
  state.fallbackInserted = true
}

// `detachContent` is true only on the first content -> fallback switch: the
// (invalid) content gets parked outside the DOM while staying alive. When
// replacing an already active fallback, the content is parked already.
function commitSlotFallback(
  state: SlotResolutionState,
  rendered: RenderedSlotFallback[],
  scope: EffectScope,
  detachContent: boolean,
): void {
  // the nearest valid one, or the outermost one when none is valid
  const active = rendered[rendered.length - 1]
  const block = active.block
  state.activeFallback = block
  state.renderedFallbacks = rendered
  state.fallbackScope = scope
  state.fallbackInserted = isHydrating || active.adopted
  if (isTransitionEnabled) {
    if (state.$transition) {
      // Match VDOM slot fallback branch identity so fallback enter does not
      // early-remove the currently leaving slot content.
      if (!isArray(block)) setBlockKey(block, '_fb')
      state.$transition = applyTransitionHooks(
        block,
        state.$transition,
        ownerFragment(state),
      )
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
  beforeExpose(state, block)
  insertActiveSlotFallback(state)
}

// A vapor SlotFragment is its own resolution state; an interop outlet keeps
// its state apart from the fragment, so only the former owns a key context.
function ownerFragment(state: SlotResolutionState): VaporFragment | undefined {
  const frag = state as unknown as VaporFragment
  return frag.__vf ? frag : undefined
}

// The host has a provider (hasSlotFallback): the caller checks.
function renderAndCommitSlotFallback(state: SlotResolutionState): void {
  // A dedicated detached scope: the fallbacks must not die with whatever
  // branch scope happens to be active when a recheck fires. The host stops
  // it on replacement or disposal; a failed render is stopped here.
  const scope = new EffectScope(true)
  let rendered: RenderedSlotFallback[]
  try {
    rendered = renderSlotFallbacks(state.boundary, scope)
  } catch (err) {
    scope.stop()
    throw err
  }
  const hadFallback = !!state.activeFallback
  clearSlotFallback(state)
  state.fallbackChainStale = false
  commitSlotFallback(state, rendered, scope, !hadFallback)
}

// Whether the rendered chain no longer resolves to the right fallback: the
// providers changed, a nearer rendered one became valid, or the active one
// is invalid while the host has providers beyond the rendered ones. Any
// takes a fresh walk.
function isSlotFallbackChainStale(
  state: SlotResolutionState,
  activeValid: boolean,
): boolean {
  if (state.fallbackChainStale) return true
  const rendered = state.renderedFallbacks!
  const last = rendered.length - 1
  for (let i = 0; i < last; i++) {
    if (isValidSlot(rendered[i].block)) return true
  }
  return !activeValid && hasSlotFallback(rendered[last].boundary.getParent())
}

export function disposeSlotResolution(
  state: SlotResolutionState,
  parentNode?: ParentNode,
): void {
  // The enclosing block owns DOM removal when no parent is passed.
  clearSlotFallback(state, parentNode || null)
  state.pendingRecheck = false
  state.lastNodesValid = undefined
}

// Reconciles which branch the slot exposes after something may have changed:
// the content's validity, a rendered fallback's validity, or (hosts flag it)
// the provider chain itself. Ordinary dirty notifications from the active
// fallback's own dynamic children re-render nothing; those children update in
// place.
export function recheckSlotResolution(state: SlotResolutionState): void {
  if (state.isReconciling) {
    state.pendingRecheck = true
    return
  }

  do {
    state.pendingRecheck = false
    state.isReconciling = true
    try {
      recheckSlotResolutionNow(state)
    } finally {
      state.isReconciling = false
    }
  } while (state.pendingRecheck)
}

function recheckSlotResolutionNow(state: SlotResolutionState): void {
  const fallback = state.activeFallback
  const fallbackValid = !!fallback && isValidSlot(fallback)
  const contentValid = state.isContentValid()
  // Validity of the currently exposed branch (fallback if active, else content).
  const prevNodesValid =
    state.lastNodesValid ?? (fallback ? fallbackValid : contentValid)

  // Content wins over fallback. If fallback was mounted, content may need to
  // be inserted back because it can be invalid while fallback is active. It
  // also returns, invalid or not, once the host lost its last fallback, so
  // its anchors are live for later updates.
  if (contentValid || (fallback && !hasSlotFallback(state.boundary))) {
    if (fallback) {
      clearSlotFallback(state)
      const content = state.getContent()
      // content rendered behind the fallback from the start has no hooks yet
      const transition = isTransitionEnabled ? state.$transition : undefined
      if (transition && isFragment(content) && !content.$transition) {
        state.$transition = applyTransitionHooks(
          content,
          transition,
          ownerFragment(state),
        )
      }
      beforeExpose(state, content)
      if (!isHydrating) {
        const parentNode = state.getParentNode()
        if (parentNode) {
          insert(content, parentNode, state.getAnchor())
        }
      }
    }
  } else if (fallback) {
    if (isSlotFallbackChainStale(state, fallbackValid)) {
      renderAndCommitSlotFallback(state)
    } else if (!prevNodesValid && fallbackValid) {
      // A fallback committed while invalid is inserted once it becomes valid.
      insertActiveSlotFallback(state)
    }
  } else if (hasSlotFallback(state.boundary)) {
    renderAndCommitSlotFallback(state)
  }

  const nextFallback = state.activeFallback
  const nextNodesValid = nextFallback
    ? nextFallback === fallback
      ? fallbackValid
      : isValidSlot(nextFallback)
    : contentValid
  state.syncNodes()
  state.lastNodesValid = nextNodesValid
  if (prevNodesValid !== nextNodesValid) {
    state.notifyExposedValidityChange()
  }
}
