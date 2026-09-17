import {
  type ObjectEmitsOptions,
  baseEmit,
  defaultPropGetter,
} from '@vue/runtime-dom'
import type { VaporComponent, VaporComponentInstance } from './component'
import { EMPTY_OBJ, isArray } from '@vue/shared'
import { getAttrFromRawProps } from './componentProps'
import { isInteropEnabled } from './vdomInteropState'

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
  const vnode = isInteropEnabled && instance.interopVNode
  baseEmit(
    instance,
    vnode ? vnode.props || EMPTY_OBJ : instance.rawProps || EMPTY_OBJ,
    vnode ? defaultPropGetter : getAttrFromRawProps,
    event,
    ...rawArgs,
  )
}
