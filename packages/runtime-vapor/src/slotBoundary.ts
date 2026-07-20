import type { EffectScope } from '@vue/reactivity'
import { type BlockFn, isValidSlot } from './block'
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
  // late renders such as fallback bodies, and runs them in the provided effect
  // scope when one is provided.
  run<R>(fn: () => R, scope?: EffectScope): R
  // Notifies the owning slot that the validity of a dynamic branch rendered
  // under this boundary may have changed; routes into the slot resolution
  // state machine (markSlotResolutionDirty).
  markDirty: (force?: boolean) => void
  onContentInvalid?: (() => void)[]
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
export function trackSlotBoundaryDirtying(
  fragment: VaporFragment,
  onInvalid?: () => void,
): void {
  const boundary = currentSlotBoundary
  if (!boundary) return

  if (onInvalid) {
    registerContentInvalid(boundary, onInvalid, fragment)
  }

  let prevValid: boolean
  ;(fragment.onBeforeUpdate ||= []).push(() => {
    prevValid = isValidSlot(fragment)
  })
  ;(fragment.onUpdated ||= []).push(() => {
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
  ;(fragment.onRemove ||= []).push(unregister)
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
