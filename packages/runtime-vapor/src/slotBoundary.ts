import type { EffectScope } from '@vue/reactivity'
import { type BlockFn, isValidBlock } from './block'
import type { VaporFragment } from './fragment'

// A slot boundary is one slot outlet's fallback-resolution point. Forwarded
// slots chain boundaries through `parent`: when <Inner> renders a <slot>
// inside <Outer>'s slot content, missing/invalid content resolves against
// Inner's own fallback first, then Outer's, and so on outward
// (renderSlotFallback in slotFragment.ts walks this chain).
export interface SlotBoundaryContext {
  parent: SlotBoundaryContext | null
  getFallback: () => BlockFn | undefined
  // Re-establishes the owning slot's ambient slot / fragment context around
  // late renders such as fallback bodies, which run long after the slot's own
  // setup finished.
  run<R>(fn: () => R, scope?: EffectScope): R
  // Notifies the owning slot that the validity of a dynamic branch rendered
  // under this boundary may have changed; routes into the slot resolution
  // state machine (markSlotResolutionDirty).
  markDirty: () => void
  // Cached fallback-masking view of this boundary, used while rendering its
  // own fallback (see getRedirectedBoundary in slotFragment.ts).
  redirected?: SlotBoundaryContext
}

export let currentSlotBoundary: SlotBoundaryContext | null = null

export function setCurrentSlotBoundary(
  b: SlotBoundaryContext | null,
): SlotBoundaryContext | null {
  try {
    return currentSlotBoundary
  } finally {
    currentSlotBoundary = b
  }
}

export function withSlotBoundary<R>(
  boundary: SlotBoundaryContext | null,
  fn: () => R,
): R {
  const prev = setCurrentSlotBoundary(boundary)
  try {
    return fn()
  } finally {
    setCurrentSlotBoundary(prev)
  }
}

// Dynamic children (`v-if`, `v-for`, interop fragments) created under a slot
// boundary dirty the boundary only when their rendered validity changes.
export function trackSlotBoundaryDirtying(fragment: VaporFragment): void {
  const boundary = currentSlotBoundary
  if (!boundary) return

  let prevValid: boolean
  ;(fragment.onBeforeUpdate ||= []).push(() => {
    prevValid = isValidBlock(fragment)
  })
  ;(fragment.onUpdated ||= []).push(() => {
    if (isValidBlock(fragment) !== prevValid) {
      boundary.markDirty()
    }
  })
}

export function hasSlotFallback(
  boundary: SlotBoundaryContext | null | undefined,
): boolean {
  while (boundary) {
    if (boundary.getFallback()) {
      return true
    }
    boundary = boundary.parent
  }
  return false
}
