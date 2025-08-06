import { currentInstance, resolveDynamicComponent } from '@vue/runtime-dom'
import { insert } from './block'
import { createComponentWithFallback, emptyContext } from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { DYNAMIC_COMPONENT_ANCHOR_LABEL } from '@vue/shared'
import { advanceHydrationNode, isHydrating } from './dom/hydration'
import { DynamicFragment, type VaporFragment } from './fragment'

export function createDynamicComponent(
  getter: () => any,
  rawProps?: RawProps | null,
  rawSlots?: RawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
  scopeId?: string,
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
    const appContext =
      (currentInstance && currentInstance.appContext) || emptyContext
    frag.update(
      () =>
        createComponentWithFallback(
          resolveDynamicComponent(value) as any,
          rawProps,
          rawSlots,
          isSingleRoot,
          once,
          scopeId,
          appContext,
        ),
      value,
    )
  })

  if (!isHydrating) {
    if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  } else {
    if (_insertionAnchor !== undefined) {
      advanceHydrationNode(_insertionParent!)
    }
  }

  return frag
}
