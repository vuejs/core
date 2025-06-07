import { resolveDynamicComponent } from '@vue/runtime-dom'
import { DynamicFragment, type VaporFragment, insert } from './block'
import { createComponentWithFallback } from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'
import { isHydrating } from './dom/hydration'
import { insertionAnchor, insertionParent } from './insertionState'

export function createDynamicComponent(
  getter: () => any,
  rawProps?: RawProps | null,
  rawSlots?: RawSlots | null,
  isSingleRoot?: boolean,
): VaporFragment {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor

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

  if (!isHydrating && _insertionParent) {
    insert(frag, _insertionParent, _insertionAnchor)
  }
  return frag
}
