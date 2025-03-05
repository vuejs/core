import { currentInstance, resolveDynamicComponent } from '@vue/runtime-dom'
import { DynamicFragment, type VaporFragment } from './block'
import { createComponentWithFallback, emptyContext } from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'

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
    const appContext =
      (currentInstance && currentInstance.appContext) || emptyContext
    frag.update(
      () =>
        createComponentWithFallback(
          resolveDynamicComponent(value) as any,
          rawProps,
          rawSlots,
          isSingleRoot,
          appContext,
        ),
      value,
    )
  })
  return frag
}
