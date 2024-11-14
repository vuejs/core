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
import { setClass, setDynamicProp } from './dom/prop'
import { setStyle } from './dom/style'

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

  instance.scopeIds = [...current.scopeIds]
  const scopeId = current.type.__scopeId
  if (scopeId) instance.scopeIds.push(scopeId)

  setupComponent(instance)

  // register sub-component with current component for lifecycle management
  current.comps.add(instance)

  return instance
}

function fallbackComponent(
  comp: string,
  rawProps: RawProps | null,
  slots: RawSlots | null,
  instance: ComponentInternalInstance,
  singleRoot: boolean = false,
): HTMLElement {
  // eslint-disable-next-line no-restricted-globals
  const el = document.createElement(comp)

  if (rawProps || Object.keys(instance.attrs).length) {
    rawProps = [() => instance.attrs, ...normalizeRawProps(rawProps)]

    renderEffect(() => {
      let classes: unknown[] | undefined
      let styles: unknown[] | undefined

      walkRawProps(
        rawProps as NormalizedRawProps,
        (key, valueOrGetter, getter) => {
          const value = getter ? valueOrGetter() : valueOrGetter
          if (key === 'class') (classes ||= []).push(value)
          else if (key === 'style') (styles ||= []).push(value)
          else setDynamicProp(el, key, value)
        },
      )

      if (classes) setClass(el, classes)
      if (styles) setStyle(el, styles)
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

  if (singleRoot) {
    instance.dynamicAttrs = true
    for (let i = 0; i < instance.scopeIds.length; i++) {
      const id = instance.scopeIds[i]
      el.setAttribute(id, '')
    }
  }

  const scopeId = instance.type.__scopeId
  if (scopeId) el.setAttribute(scopeId, '')

  return el
}
