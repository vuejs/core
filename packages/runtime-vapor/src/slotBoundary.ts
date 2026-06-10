import type { EffectScope } from '@vue/reactivity'
import { type BlockFn, isValidBlock } from './block'
import type { VaporFragment } from './fragment'

export interface SlotBoundaryContext {
  parent: SlotBoundaryContext | null
  getFallback: () => BlockFn | undefined
  run<R>(fn: () => R, scope?: EffectScope): R
  markDirty: () => void
  redirected?: SlotBoundaryContext
}

export let currentSlotBoundary: SlotBoundaryContext | null = null

export function getCurrentSlotBoundary(): SlotBoundaryContext | null {
  return currentSlotBoundary
}

export function setCurrentSlotBoundary(
  b: SlotBoundaryContext | null,
): SlotBoundaryContext | null {
  try {
    return currentSlotBoundary
  } finally {
    currentSlotBoundary = b
  }
}

export function withOwnedSlotBoundary<R>(
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
  let prevValid = isValidBlock(fragment)
  ;(fragment.onBeforeUpdate ||= []).push(() => {
    prevValid = isValidBlock(fragment)
  })
  ;(fragment.onUpdated ||= []).push(() => {
    const valid = isValidBlock(fragment)
    if (valid !== prevValid) {
      boundary.markDirty()
    }
    prevValid = valid
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
