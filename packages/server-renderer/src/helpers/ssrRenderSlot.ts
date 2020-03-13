import { Props, PushFn, renderVNodeChildren } from '../renderToString'
import { ComponentInternalInstance, Slot, Slots } from 'vue'

export type SSRSlots = Record<string, SSRSlot>

export type SSRSlot = (
  props: Props,
  push: PushFn,
  parentComponent: ComponentInternalInstance | null,
  scopeId: string | null
) => void

export function ssrRenderSlot(
  slots: Slots | SSRSlots,
  slotName: string,
  slotProps: Props,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance
) {
  // template-compiled slots are always rendered as fragments
  push(`<!--[-->`)
  const slotFn = slots[slotName]
  if (slotFn) {
    if (slotFn.length > 1) {
      // only ssr-optimized slot fns accept more than 1 arguments
      const scopeId = parentComponent && parentComponent.type.__scopeId
      slotFn(slotProps, push, parentComponent, scopeId ? ` ${scopeId}-s` : ``)
    } else {
      // normal slot
      renderVNodeChildren(push, (slotFn as Slot)(slotProps), parentComponent)
    }
  } else if (fallbackRenderFn) {
    fallbackRenderFn()
  }
  push(`<!--]-->`)
}
