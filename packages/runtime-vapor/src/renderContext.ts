import type { SuspenseBoundary } from '@vue/runtime-dom'
import type { VaporComponentInstance } from './component'
import type { SlotBoundaryContext } from './slotBoundary'

export interface RenderContext {
  readonly slotOwner: VaporComponentInstance | null
  readonly slotBoundary: SlotBoundaryContext | null
  readonly slotScopeIds: string[] | null
  readonly suspense: SuspenseBoundary | null
}

export let currentRenderContext: RenderContext = {
  slotOwner: null,
  slotBoundary: null,
  slotScopeIds: null,
  suspense: null,
}

export function setRenderContext(ctx: RenderContext): RenderContext {
  const prev = currentRenderContext
  currentRenderContext = ctx
  return prev
}

export function withRenderContext<R>(ctx: RenderContext, fn: () => R): R {
  if (ctx === currentRenderContext) return fn()
  const prev = setRenderContext(ctx)
  try {
    return fn()
  } finally {
    currentRenderContext = prev
  }
}

export function deriveRenderContext(
  base: RenderContext,
  slotOwner: VaporComponentInstance | null,
  slotBoundary: SlotBoundaryContext | null,
  slotScopeIds: string[] | null,
  suspense: SuspenseBoundary | null,
): RenderContext {
  // returns `base` when nothing changes, so unchanged contexts allocate nothing
  return slotOwner === base.slotOwner &&
    slotBoundary === base.slotBoundary &&
    slotScopeIds === base.slotScopeIds &&
    suspense === base.suspense
    ? base
    : { slotOwner, slotBoundary, slotScopeIds, suspense }
}

export function deriveSlotOwner(
  base: RenderContext,
  slotOwner: VaporComponentInstance | null,
): RenderContext {
  return deriveRenderContext(
    base,
    slotOwner,
    base.slotBoundary,
    base.slotScopeIds,
    base.suspense,
  )
}

export function deriveSlotBoundary(
  base: RenderContext,
  slotBoundary: SlotBoundaryContext | null,
): RenderContext {
  return deriveRenderContext(
    base,
    base.slotOwner,
    slotBoundary,
    base.slotScopeIds,
    base.suspense,
  )
}

export function deriveSlotScopeIds(
  base: RenderContext,
  slotScopeIds: string[] | null,
): RenderContext {
  return deriveRenderContext(
    base,
    base.slotOwner,
    base.slotBoundary,
    slotScopeIds,
    base.suspense,
  )
}

export function deriveSuspense(
  base: RenderContext,
  suspense: SuspenseBoundary | null,
): RenderContext {
  return deriveRenderContext(
    base,
    base.slotOwner,
    base.slotBoundary,
    base.slotScopeIds,
    suspense,
  )
}
