import { EffectScope } from '@vue/reactivity'
import { NO, extend, isArray } from '@vue/shared'
import type { MoveType, SuspenseBoundary } from '@vue/runtime-dom'
import {
  type Block,
  type VaporTransitionHooks,
  insert,
  isValidSlot,
  move,
  remove,
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
import type { VaporComponentInstance } from './component'
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
// Invalid content stays alive and in the DOM (it consists of anchors and
// comments only); the fallback is placed after it. Content roots keep
// rendering in place, except under a Transition showing the fallback, where
// the host holds them out of the DOM until the content takes over
// (slotBoundary.ts `isHolding`).
//
// The machine is written against the duck-typed SlotResolutionState interface
// because it has three hosts: SlotFragment (vapor slots) and the two interop
// slot implementations in vdomInterop.ts, which keep their per-slot state in
// closures.

export interface RenderedSlotFallback {
  block: Block
  boundary: SlotBoundaryContext
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
      // The body sees no provider of its own: an outlet inside it exposes its
      // invalidity to the host instead of resolving the same fallback again.
      // Nor is it held by the host it is the fallback of.
      const body = extend({}, boundary, {
        getFallback: noFallback,
        isHolding: NO,
      })
      const block = boundary.run(
        () =>
          withSlotBoundary(body, adopt ? () => adopt(renderBody) : renderBody),
        scope,
      )
      rendered.push({ block, boundary, adopted: !!adopt })
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

// A Transition showing the fallback holds the content out of the DOM.
export function isHoldingSlotContent(state: SlotResolutionState): boolean {
  return isTransitionEnabled && !!state.$transition && !!state.activeFallback
}

// The host places its content, in the DOM even while invalid, and the
// machine the fallback after it.
export function placeSlotContent(
  state: SlotResolutionState,
  parent: ParentNode,
  anchor: Node | null,
  parentSuspense?: SuspenseBoundary | null,
  moveType?: MoveType,
  parentComponent?: VaporComponentInstance,
): void {
  const content = state.getContent()
  if (moveType === undefined) {
    insert(content, parent, anchor, parentSuspense)
  } else {
    move(content, parent, anchor, moveType, parentComponent, parentSuspense)
  }
  insertActiveSlotFallback(state, moveType, parentComponent, parentSuspense)
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
    remove(fallback, parentNode || undefined)
    state.activeFallback = null
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

// A fallback is placed even while invalid: its anchors have to be live for it
// to update in place. It goes after the content, at the host's anchor.
export function insertActiveSlotFallback(
  state: SlotResolutionState,
  moveType?: MoveType,
  parentComponent?: VaporComponentInstance,
  parentSuspense?: SuspenseBoundary | null,
): void {
  const fallback = state.activeFallback
  if (isHydrating || !fallback) return
  const parentNode = state.getParentNode()
  if (!parentNode) return
  const anchor = state.getAnchor()
  // hydration: the fallback adopted from the server is in the DOM already
  // and stays where the server put it. A vdom one keeps its own record of
  // where that is.
  if (isHydratingSlotFallback) {
    const rendered = state.renderedFallbacks!
    if (rendered[rendered.length - 1].adopted) {
      if (isInteropEnabled && isInteropFragment(fallback)) {
        fallback.insert!(parentNode, anchor)
      }
      return
    }
  }
  if (moveType === undefined) {
    insert(fallback, parentNode, anchor, parentSuspense)
  } else {
    move(
      fallback,
      parentNode,
      anchor,
      moveType,
      parentComponent,
      parentSuspense,
    )
  }
}

function commitSlotFallback(
  state: SlotResolutionState,
  rendered: RenderedSlotFallback[],
  scope: EffectScope,
): void {
  // the nearest valid one, or the outermost one when none is valid
  const active = rendered[rendered.length - 1]
  const block = active.block
  state.activeFallback = block
  state.renderedFallbacks = rendered
  state.fallbackScope = scope
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
  beforeExpose(state, block)
  insertActiveSlotFallback(state)
}

// A vapor SlotFragment is its own resolution state; an interop outlet keeps
// its state apart from the fragment, so only the former owns a key context.
function ownerFragment(state: SlotResolutionState): VaporFragment | undefined {
  const frag = state as unknown as VaporFragment
  return frag.__vf ? frag : undefined
}

function renderAndCommitSlotFallback(state: SlotResolutionState): void {
  if (state.fallbackChainStale) state.fallbackChainStale = false
  if (!hasSlotFallback(state.boundary)) {
    // the providers went away: nothing replaces the fallback
    if (state.activeFallback) clearSlotFallback(state)
    return
  }
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
  clearSlotFallback(state)
  commitSlotFallback(state, rendered, scope)
}

// Whether the rendered chain no longer resolves to the right fallback: the
// providers changed, a nearer rendered one became valid, or the active one
// is invalid while the host has providers beyond the rendered ones. Any
// takes a fresh walk.
function isSlotFallbackChainStale(state: SlotResolutionState): boolean {
  if (state.fallbackChainStale) return true
  const rendered = state.renderedFallbacks!
  const last = rendered.length - 1
  for (let i = 0; i < last; i++) {
    if (isValidSlot(rendered[i].block)) return true
  }
  return (
    hasSlotFallback(rendered[last].boundary.getParent()) &&
    !isValidSlot(rendered[last].block)
  )
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
// the content's validity, a rendered fallback's validity, or (interop hosts
// flag it) the provider chain itself. Ordinary dirty notifications from the
// active fallback's own dynamic children re-render nothing; those children
// update in place.
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

// Valid content takes over from the active fallback. It is in place already,
// unless the host held it: then it is placed after the fallback's leave, as
// vdom unmounts the old child before the new one enters.
function exposeSlotContent(state: SlotResolutionState): void {
  const content = state.getContent()
  const place =
    isTransitionEnabled && !isHydrating && state.boundary.isHolding()
  clearSlotFallback(state)
  const transition = isTransitionEnabled ? state.$transition : undefined
  // content first shown after a mount-time fallback has no hooks yet
  if (transition && (place || (isFragment(content) && !content.$transition))) {
    state.$transition = applyTransitionHooks(
      content,
      transition,
      ownerFragment(state),
    )
  }
  beforeExpose(state, content)
  if (place) {
    const parentNode = state.getParentNode()
    if (parentNode) insert(content, parentNode, state.getAnchor())
  }
}

function recheckSlotResolutionNow(state: SlotResolutionState): void {
  const prevFallback = state.activeFallback
  const contentValid = state.isContentValid()
  // Validity of the currently exposed branch (fallback if active, else content).
  const prevNodesValid = state.lastNodesValid ?? contentValid

  // Content wins over fallback.
  if (contentValid) {
    if (prevFallback) exposeSlotContent(state)
  } else if (!prevFallback || isSlotFallbackChainStale(state)) {
    renderAndCommitSlotFallback(state)
  }

  const fallback = state.activeFallback
  const nextNodesValid = fallback ? isValidSlot(fallback) : contentValid
  state.syncNodes()
  state.lastNodesValid = nextNodesValid
  if (prevNodesValid !== nextNodesValid) {
    state.notifyExposedValidityChange()
  }
}
