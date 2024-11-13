import {
  type Component,
  type ComponentInternalInstance,
  createComponentInstance,
  currentInstance,
} from './component'
import { setupComponent } from './apiRender'
import {
  type NormalizedRawProps,
  type RawProps,
  normalizeRawProps,
  walkRawProps,
} from './componentProps'
import { type RawSlots, isDynamicSlotFn } from './componentSlots'
import { withAttrs } from './componentAttrs'
import { isString } from '@vue/shared'
import { renderEffect } from './renderEffect'
import { normalizeBlock } from './dom/element'
import { setDynamicProp } from './dom/prop'

export function createComponent(
  comp: Component | string,
  rawProps: RawProps | null = null,
  slots: RawSlots | null = null,
  singleRoot: boolean = false,
  once: boolean = false,
): ComponentInternalInstance | HTMLElement {
  if (isString(comp)) {
    return fallbackComponent(comp, rawProps, slots)
  }

  const current = currentInstance!
  const instance = createComponentInstance(
    comp,
    singleRoot ? withAttrs(rawProps) : rawProps,
    slots,
    once,
  )
  setupComponent(instance)

  // register sub-component with current component for lifecycle management
  current.comps.add(instance)

  return instance
}

function fallbackComponent(
  comp: string,
  rawProps: RawProps | null,
  slots: RawSlots | null,
): HTMLElement {
  // eslint-disable-next-line no-restricted-globals
  const el = document.createElement(comp)

  if (rawProps) {
    rawProps = normalizeRawProps(rawProps)
    renderEffect(() => {
      walkRawProps(rawProps as NormalizedRawProps, (key, value, getter) => {
        setDynamicProp(el, key, getter ? value() : value)
      })
    })
  }

  if (slots) {
    if (!Array.isArray(slots)) slots = [slots]
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      if (!isDynamicSlotFn(slot) && slot.default) {
        const block = slot.default && slot.default()
        if (block) el.append(...normalizeBlock(block))
      }
    }
  }

  return el
}
