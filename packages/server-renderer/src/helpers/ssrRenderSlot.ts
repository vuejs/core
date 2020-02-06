import { Props, PushFn, renderVNodeChildren } from '../renderToString'
import { ComponentInternalInstance, Slot, Slots } from 'vue'

export type SSRSlots = Record<string, SSRSlot>

export type SSRSlot = (
  props: Props,
  push: PushFn,
  parentComponent: ComponentInternalInstance | null
) => void

export function ssrRenderSlot(
  slots: Slots | SSRSlots,
  slotName: string,
  slotProps: Props,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance | null = null
) {
  const slotFn = slots[slotName]
  // template-compiled slots are always rendered as fragments
  push(`<!---->`)
  if (slotFn) {
    if (slotFn.length > 1) {
      // only ssr-optimized slot fns accept more than 1 arguments
      slotFn(slotProps, push, parentComponent)
    } else {
      // normal slot
      renderVNodeChildren(push, (slotFn as Slot)(slotProps), parentComponent)
    }
  } else if (fallbackRenderFn) {
    fallbackRenderFn()
  }
  push(`<!---->`)
}
