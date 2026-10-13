import type { EffectScope } from '@vue/reactivity'
import { type Block, type BlockFn, isValidSlot } from './block'
import type { VaporFragment } from './fragment'
import {
  currentRenderContext,
  deriveSlotBoundary,
  withRenderContext,
} from './renderContext'

// A slot boundary is one slot host's fallback-resolution point. `getParent`
// returns the next fallback provider of the same host (an interop slot stands
// in for every vdom outlet forwarding it), never an enclosing outlet: a host
// renders only the fallbacks it provides itself.
// renderSlotFallbacks in slotFragment.ts walks this chain.
export interface SlotBoundaryContext {
  getParent: () => SlotBoundaryContext | null
  getFallback: () => BlockFn | undefined
  // hydration: the server rendered this provider's fallback in place of the
  // content (`<!--(-->`). The host renders it through this, once, to adopt
  // it where it is. A hook so that client-only bundles carry no hydration.
  adoptFallback?: (render: BlockFn) => Block
  // Re-establishes the owning slot's ambient slot / fragment context around
  // late renders such as fallback bodies, and runs them in the provided effect
  // scope when one is provided.
  run<R>(fn: () => R, scope?: EffectScope): R
  // The slot scope ids this provider's fallback renders under: the providing
  // outlet's cell (see renderSlotFallbacks).
  getScopeIds?: () => string[] | null
  // Notifies the owning slot that the validity of a dynamic branch rendered
  // under this boundary may have changed; routes into the slot resolution
  // state machine (markSlotResolutionDirty).
  markDirty: () => void
  onContentInvalid?: (() => void)[]
}

export function withSlotBoundary<R>(
  boundary: SlotBoundaryContext | null,
  fn: () => R,
): R {
  return withRenderContext(
    deriveSlotBoundary(currentRenderContext, boundary),
    fn,
  )
}

// Dynamic children (`v-if`, `v-for`, interop fragments) created under a slot
// boundary dirty the boundary only when their rendered validity changes.
export function trackSlotBoundaryDirtying(
  fragment: VaporFragment,
  onInvalid?: () => void,
): void {
  const boundary = currentRenderContext.slotBoundary
  if (!boundary) return

  if (onInvalid) {
    registerContentInvalid(boundary, onInvalid, fragment)
  }

  let prevValid: boolean
  ;(fragment.bu ||= []).push(() => {
    prevValid = isValidSlot(fragment)
  })
  ;(fragment.u ||= []).push(() => {
    if (isValidSlot(fragment) !== prevValid) {
      boundary.markDirty()
    }
  })
}

export function registerContentInvalid(
  boundary: SlotBoundaryContext,
  onInvalid: () => void,
  fragment: VaporFragment,
): void {
  const callbacks = (boundary.onContentInvalid ||= [])
  callbacks.push(onInvalid)
  const unregister = () => {
    const index = callbacks.indexOf(onInvalid)
    if (index > -1) callbacks.splice(index, 1)
  }
  // The callback belongs to the slot-root fragment; remove it with that
  // fragment so stale branches do not stay on a long-lived boundary.
  ;(fragment.bum ||= []).push(unregister)
}

export function hasSlotFallback(
  boundary: SlotBoundaryContext | null | undefined,
): boolean {
  while (boundary) {
    if (boundary.getFallback()) {
      return true
    }
    boundary = boundary.getParent()
  }
  return false
}
