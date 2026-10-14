import type { EffectScope } from '@vue/reactivity'
import type { Block, BlockFn } from './block'
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
  // Whether slot roots under this boundary render held, out of the DOM: the
  // host shows a fallback under a Transition and places the content itself
  // once it takes over, after the fallback's leave.
  isHolding: () => boolean
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
