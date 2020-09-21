import { ComponentInternalInstance, Slots } from 'vue'
import { Props, PushFn, renderVNodeChildren } from '../render'

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
    const scopeId = parentComponent && parentComponent.type.__scopeId
    const ret = slotFn(
      slotProps,
      push,
      parentComponent,
      scopeId ? ` ${scopeId}-s` : ``
    )
    if (Array.isArray(ret)) {
      // normal slot
      renderVNodeChildren(push, ret, parentComponent)
    }
  } else if (fallbackRenderFn) {
    fallbackRenderFn()
  }
  push(`<!--]-->`)
}
