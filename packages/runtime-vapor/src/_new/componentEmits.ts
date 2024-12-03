import type { EmitFn, ObjectEmitsOptions } from '@vue/runtime-core'
import {
  type VaporComponent,
  type VaporComponentInstance,
  currentInstance,
} from './component'
import { NOOP, isArray } from '@vue/shared'

/**
 * The logic from core isn't too reusable so it's better to duplicate here
 */
export function normalizeEmitsOptions(
  comp: VaporComponent,
): ObjectEmitsOptions | null {
  const cached = comp.__emitsOptions
  if (cached) return cached

  const raw = comp.emits
  if (!raw) return null

  let normalized: ObjectEmitsOptions
  if (isArray(raw)) {
    normalized = {}
    for (const key in raw) normalized[key] = null
  } else {
    normalized = raw
  }

  return (comp.__emitsOptions = normalized)
}

export function useEmit(): EmitFn {
  if (!currentInstance) {
    // TODO warn
    return NOOP
  } else {
    return emit.bind(null, currentInstance)
  }
}

export function emit(
  instance: VaporComponentInstance,
  event: string,
  ...rawArgs: any[]
): void {
  // TODO extract reusable logic from core
}
