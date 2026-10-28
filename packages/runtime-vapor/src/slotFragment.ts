import { EffectScope } from '@vue/reactivity'
import { NOOP, extend } from '@vue/shared'
import type { MoveType, SuspenseBoundary } from '@vue/runtime-dom'
import {
  type Block,
  EMPTY_BLOCK,
  type VaporTransitionHooks,
  insert,
  isValidSlot,
  move,
  remove,
} from './block'
import {
  hydrateBlock,
  isHydrating,
  isHydratingSlotFallback,
} from './dom/hydration'
import { renderWithSlotScopeIds } from './scopeId'
import {
  type SlotBoundaryContext,
  hasSlotFallback,
  withSlotBoundary,
} from './slotBoundary'
import {
  applyTransitionHooks,
  applyTransitionLeaveHooks,
  awaitLeavingRoot,
  isTransitionEnabled,
  isVaporTransitionHooks,
  ownsTransitionMode,
  resolveOutletLeave,
} from './transition'
import type { VaporComponentInstance } from './component'
import { type VaporFragment, isInteropFragment } from './fragment'
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
// rendering in place, except under a Transition, where the host holds them
// detached until it sequences the swap (slotBoundary.ts `isHolding`).
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

// Blocks committed as a fallback: Transition keys what is under them apart
// from the content, as vdom keys a slot's fallback fragment `_<name>_fb`.
const slotFallbackBlocks: WeakSet<object> = new WeakSet()

export function isSlotFallbackBlock(block: Block): boolean {
  return slotFallbackBlocks.has(block)
}

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
      // It is held only by an enclosing outlet, never by the host it is the
      // fallback of.
      const body = extend({}, boundary, {
        getFallback: noFallback,
        isHolding: boundary.isHeld,
      })
      // an adopted fallback owns its mismatches inside `adopt`
      const renderFallback = adopt
        ? () => adopt(renderBody)
        : isHydrating
          ? () => hydrateBlock(renderBody)
          : renderBody
      const block = boundary.run(
        () => withSlotBoundary(body, renderFallback),
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
  // out-in: the fallback leaves on its own first (`leaving`: rechecks wait,
  // roots render held), then the held roots are placed (`placing`); or the
  // fallback waits to enter until the content root's own leave ends
  // (`entering`).
  held?: 'leaving' | 'placing' | 'entering'
  // a host of vapor content holds and places it (a host patching vnode
  // content leaves it in place)
  holdsContent?: boolean
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
  // An interop host patching vnode content: `cb` follows the leave its
  // content root is running on its own, if any. A vapor root is found
  // through the content block instead.
  awaitLeavingRoot?(cb: () => void): boolean
}

// The host's own reason to hold its content detached: a fallback shows (or
// leaves under out-in) under a Transition, which sequences the swap.
export function isHoldingSlotContent(state: SlotResolutionState): boolean {
  return (
    isTransitionEnabled &&
    !!state.$transition &&
    !!(
      state.activeFallback ||
      state.held === 'leaving' ||
      state.held === 'entering'
    )
  )
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
  insertActiveSlotFallback(
    state,
    moveType,
    parent,
    anchor,
    parentComponent,
    parentSuspense,
  )
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
  // a fallback waiting to enter is not in the DOM yet: until then the root
  // leaving ahead of it is what the host exposes
  if (isTransitionEnabled && state.held === 'entering') {
    return state.getContent()
  }
  return state.activeFallback || state.getContent()
}

// The notifications of the outlet a branch resumed after a leave reports to
// (components/Transition.ts removeBranchWithLeaveImpl): they wait for the
// branch being rendered, as outlets inside it notify before it is in place.
// Matched by `markDirty` rather than the boundary: a fallback body reports
// through a copy of its provider's boundary.
let settlingNotify: (() => void) | null = null

export function setSettlingNotify(
  notify: (() => void) | null,
): (() => void) | null {
  const prev = settlingNotify
  settlingNotify = notify
  return prev
}

// Entry point for validity-change notifications (boundary.markDirty). During
// reconciliation or a host content update, fold notifications into the
// in-flight operation instead of recursing.
export function markSlotResolutionDirty(state: SlotResolutionState): void {
  if (state.isDisposed()) {
    return
  }
  if (
    state.isReconciling ||
    state.isBusy() ||
    (isTransitionEnabled && state.boundary.markDirty === settlingNotify)
  ) {
    state.pendingRecheck = true
    return
  }
  recheckSlotResolution(state)
}

export function clearSlotFallback(
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

// The fallback leaves under `hooks`, with `afterLeave` following. False when
// there is nothing to animate: it is gone at once. The caller owns placing
// the content.
export function leaveSlotFallback(
  state: SlotResolutionState,
  hooks: VaporTransitionHooks,
  afterLeave: () => void,
  unpaired?: boolean,
): boolean {
  const fallback = state.activeFallback
  const leaving =
    !!fallback &&
    applyTransitionLeaveHooks(fallback, hooks, afterLeave, unpaired)
  clearSlotFallback(state)
  return leaving
}

// A fallback is placed even while invalid: its anchors have to be live for it
// to update in place. It goes after the content, at the placement's own
// target: the host's anchor may still be on its way when a move places it.
export function insertActiveSlotFallback(
  state: SlotResolutionState,
  moveType: MoveType | undefined,
  parentNode: ParentNode | null,
  anchor: Node | null,
  parentComponent?: VaporComponentInstance,
  parentSuspense?: SuspenseBoundary | null,
): void {
  const fallback = state.activeFallback
  if (isHydrating || !fallback || !parentNode) return
  // waiting to enter: the recheck at the end of the leave places it
  if (isTransitionEnabled && state.held === 'entering') return
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
  const block = rendered[rendered.length - 1].block
  state.activeFallback = block
  state.renderedFallbacks = rendered
  state.fallbackScope = scope
  if (isTransitionEnabled) {
    // before Transition applies its hooks, which can come after a
    // mount-time fallback
    if (block !== EMPTY_BLOCK) slotFallbackBlocks.add(block)
    // held by an enclosing outlet: that one places and animates the
    // fallback with its own content
    if (state.boundary.isHeld()) return
    const hooks = state.$transition
    if (hooks) {
      applySlotTransitionHooks(state, block, hooks)
      // out-in: a content root still leaving on its own (it left empty, as
      // vdom's comment child) is what a fallback with a child to animate
      // swaps in for: it enters once that leave ends
      if (
        isVaporTransitionHooks(hooks) &&
        hooks.props.mode === 'out-in' &&
        awaitLeavingRoot(block, state, () => placeAfterLeave(state))
      ) {
        state.held = 'entering'
        return
      }
    }
  }
  exposeSlotFallback(state, block)
}

function exposeSlotFallback(state: SlotResolutionState, block: Block): void {
  beforeExpose(state, block)
  insertActiveSlotFallback(
    state,
    undefined,
    state.getParentNode(),
    state.getAnchor(),
  )
}

// The hooks resolved for the exposed branch become the outlet's, except a
// TransitionGroup's, which apply to every block as they are. A vapor-content
// interop outlet owns no key context: the group keys the branch where it
// collected the outlet (its fallback is vdom, keyed apart there). The other
// outlets key their fallback apart on this path; the group collector does not.
function applySlotTransitionHooks(
  state: SlotResolutionState,
  block: Block,
  hooks: VaporTransitionHooks,
): void {
  const owner = ownerFragment(state)
  if (isInteropEnabled && hooks.applyGroup && !owner && state.holdsContent) {
    hooks.applyGroup(block, hooks.props, hooks.state, hooks.instance)
  } else {
    const applied = applyTransitionHooks(block, hooks, owner)
    if (!hooks.applyGroup) state.$transition = applied
  }
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

// Valid content takes over from the active fallback. Under a Transition mode
// the two are sequenced like a vdom child swap: out-in lets the fallback
// leave alone and exposes the content after; in-out mounts the content first
// and its enter runs the fallback's delayed leave. True while the out-in
// leave runs: the leaving fallback stays exposed, the recheck at the end of
// the leave exposes the content.
function exposeSlotContent(state: SlotResolutionState): boolean {
  const content = state.getContent()
  // In place unless a Transition holds it: the host sequences the swap and
  // places it, or an enclosing outlet does both with its own content.
  let place = false
  const transition = isTransitionEnabled ? state.$transition : undefined
  if (transition && !isHydrating && !state.boundary.isHeld()) {
    // only a mode of the outlet's own sequences the swap: relayed vdom hooks,
    // and hooks inherited inside a child component, animate the branches
    const outlet = ownerFragment(state)
    const mode = ownsTransitionMode(transition, outlet)
      ? transition.props.mode
      : undefined
    const fallback = state.activeFallback
    // persisted roots are toggled in place; mode only sequences
    // structural swaps, and a persisted leave never reports its end
    const structural =
      !!fallback && !resolveOutletLeave(outlet, fallback, transition)
    if (mode === 'out-in' && structural) {
      // The content stays live meanwhile (its roots render held), and the
      // recheck at the end of the leave re-derives the branch to expose,
      // as vdom re-renders its child then: the content may have gone
      // invalid again.
      state.held = 'leaving'
      if (
        leaveSlotFallback(
          state,
          transition,
          () => placeAfterLeave(state),
          true,
        ) &&
        state.held === 'leaving'
      ) {
        return true
      }
    } else if (mode === 'in-out') {
      // The fallback leaves once the content entered: content entering
      // under these hooks claims the leave, the flush runs it otherwise.
      leaveSlotFallback(state, transition, NOOP, true)
    }
    // A host of vapor content holds and places it; a host patching vnode
    // content leaves it where it is, under the hooks its vnodes carry.
    if (state.holdsContent) {
      // content first shown after a mount-time fallback has no hooks yet:
      // Transition only reached the fallback when it mounted
      applySlotTransitionHooks(state, content, transition)
      place = true
    }
  }
  beforeExpose(state, content)
  clearSlotFallback(state)
  if (isTransitionEnabled) state.held = undefined
  if (place) {
    const parentNode = state.getParentNode()
    if (parentNode) insert(content, parentNode, state.getAnchor())
  }
  return false
}

// the leave a held branch waited on ended: the next recheck places it
function placeAfterLeave(state: SlotResolutionState): void {
  state.held = 'placing'
  markSlotResolutionDirty(state)
}

function recheckSlotResolutionNow(state: SlotResolutionState): void {
  // out-in: the fallback is leaving on its own; its end rechecks, and that
  // recheck places the held content
  let placing = false
  if (isTransitionEnabled && state.held) {
    if (state.held === 'leaving') return
    if (state.held === 'entering') {
      // content back meanwhile: it is the child to show once the leave
      // ends, as vdom renders its latest child then
      if (state.isContentValid()) clearSlotFallback(state)
      return
    }
    placing = true
  }
  const prevFallback = state.activeFallback
  const contentValid = state.isContentValid()
  // Validity of the currently exposed branch (fallback if active, else content).
  const prevNodesValid = state.lastNodesValid ?? contentValid

  // Content wins over fallback.
  if (contentValid) {
    if ((prevFallback || placing) && exposeSlotContent(state)) return
  } else {
    // the window closed on content that went invalid again
    if (placing) state.held = undefined
    if (!prevFallback || isSlotFallbackChainStale(state)) {
      renderAndCommitSlotFallback(state)
    } else if (placing) {
      // the leave the fallback waited on ended
      exposeSlotFallback(state, prevFallback)
    }
  }

  const fallback = state.activeFallback
  const nextNodesValid = fallback ? isValidSlot(fallback) : contentValid
  state.syncNodes()
  state.lastNodesValid = nextNodesValid
  if (prevNodesValid !== nextNodesValid) {
    state.notifyExposedValidityChange()
  }
}
