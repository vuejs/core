import { currentInstance, resolveDynamicComponent } from '@vue/runtime-dom'
import { insert } from './block'
import { createComponentWithFallback, emptyContext } from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'
import {
  insertionAnchor,
  insertionParent,
  isLastInsertion,
  resetInsertionState,
} from './insertionState'
import { advanceHydrationNode, isHydrating } from './dom/hydration'
import { DynamicFragment, type VaporFragment } from './fragment'

export function createDynamicComponent(
  getter: () => any,
  rawProps?: RawProps | null,
  rawSlots?: RawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
): VaporFragment {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _isLastInsertion = isLastInsertion
  if (!isHydrating) resetInsertionState()

  const frag =
    isHydrating || __DEV__
      ? new DynamicFragment('dynamic-component')
      : new DynamicFragment()

  const renderFn = () => {
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
          appContext,
        ),
      value,
    )
  }

  if (once) renderFn()
  else renderEffect(renderFn)

  if (!isHydrating) {
    if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  } else {
    if (_isLastInsertion) {
      advanceHydrationNode(_insertionParent!)
    }
  }
  return frag
}
