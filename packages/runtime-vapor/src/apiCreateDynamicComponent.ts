import { resolveDynamicComponent } from '@vue/runtime-dom'
import { createComponentWithFallback } from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'
import { DynamicFragment, type VaporFragment } from './fragment'

export function createDynamicComponent(
  getter: () => any,
  rawProps?: RawProps | null,
  rawSlots?: RawSlots | null,
  isSingleRoot?: boolean,
): VaporFragment {
  const frag = __DEV__
    ? new DynamicFragment('dynamic-component')
    : new DynamicFragment()
  renderEffect(() => {
    const value = getter()
    frag.update(
      () =>
        createComponentWithFallback(
          resolveDynamicComponent(value) as any,
          rawProps,
          rawSlots,
          isSingleRoot,
        ),
      value,
    )
  })
  return frag
}
