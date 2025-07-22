import { resolveDynamicComponent } from '@vue/runtime-dom'
import { DynamicFragment, type VaporFragment, insert } from './block'
import { createComponentWithFallback } from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { DYNAMIC_COMPONENT_ANCHOR_LABEL } from '@vue/shared'
import { isHydrating } from './dom/hydration'

export function createDynamicComponent(
  getter: () => any,
  rawProps?: RawProps | null,
  rawSlots?: RawSlots | null,
  isSingleRoot?: boolean,
): VaporFragment {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()

  const frag =
    isHydrating || __DEV__
      ? new DynamicFragment(DYNAMIC_COMPONENT_ANCHOR_LABEL)
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
