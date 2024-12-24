import { type ObjectEmitsOptions, baseEmit } from '@vue/runtime-dom'
import type { VaporComponent, VaporComponentInstance } from './component'
import { EMPTY_OBJ, hasOwn, isArray } from '@vue/shared'
import { resolveSource } from './componentProps'

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

export function emit(
  instance: VaporComponentInstance,
  event: string,
  ...rawArgs: any[]
): void {
  baseEmit(
    instance,
    instance.rawProps || EMPTY_OBJ,
    propGetter,
    event,
    ...rawArgs,
  )
}

function propGetter(rawProps: Record<string, any>, key: string) {
  const dynamicSources = rawProps.$
  if (dynamicSources) {
    let i = dynamicSources.length
    while (i--) {
      const source = resolveSource(dynamicSources[i])
      if (hasOwn(source, key)) return resolveSource(source[key])
    }
  }
  return rawProps[key] && resolveSource(rawProps[key])
}
