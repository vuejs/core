import { resolveDynamicComponent } from '@vue/runtime-dom'
import { DynamicFragment, type VaporFragment } from './block'
import { createComponentWithFallback } from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'

export function createDynamicComponent(
  getter: () => any,
  rawProps?: RawProps | null,
  rawSlots?: RawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
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
          once,
        ),
      value,
    )
  })
  return frag
}
