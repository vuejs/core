import {
  type Component,
  type ComponentInternalInstance,
  createComponentInstance,
  currentInstance,
} from './component'
import { setupComponent } from './apiRender'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'
import { withAttrs } from './componentAttrs'
import { isString } from '@vue/shared'
import { fallbackComponent } from './componentFallback'

export function createComponent(
  comp: Component | string,
  rawProps: RawProps | null = null,
  slots: RawSlots | null = null,
  singleRoot: boolean = false,
  once: boolean = false,
): ComponentInternalInstance | HTMLElement {
  const current = currentInstance!

  if (isString(comp)) {
    return fallbackComponent(comp, rawProps, slots, current, singleRoot)
  }

  const instance = createComponentInstance(
    comp,
    singleRoot ? withAttrs(rawProps) : rawProps,
    slots,
    once,
  )

  if (singleRoot) {
    instance.scopeIds.push(...current.scopeIds)
  }
  const scopeId = current.type.__scopeId
  if (scopeId) {
    instance.scopeIds.push(scopeId)
  }

  setupComponent(instance)

  // register sub-component with current component for lifecycle management
  current.comps.add(instance)

  return instance
}
