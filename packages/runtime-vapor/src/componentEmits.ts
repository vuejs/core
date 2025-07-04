import { type ObjectEmitsOptions, baseEmit } from '@vue/runtime-dom'
import type { VaporComponent, VaporComponentInstance } from './component'
import { EMPTY_OBJ, hasOwn, isArray } from '@vue/shared'
import { type RawProps, resolveSource } from './componentProps'
import { interopKey } from './vdomInterop'

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
    for (const key of raw) normalized[key] = null
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

function propGetter(rawProps: RawProps, key: string) {
  const dynamicSources = rawProps.$
  if (dynamicSources) {
    let i = dynamicSources.length
    while (i--) {
      const source = resolveSource(dynamicSources[i])
      if (hasOwn(source, key))
        // for props passed from VDOM component, no need to resolve
        return dynamicSources[interopKey]
          ? source[key]
          : resolveSource(source[key])
    }
  }
  return rawProps[key] && resolveSource(rawProps[key])
}
