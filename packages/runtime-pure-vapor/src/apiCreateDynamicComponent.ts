import {
  type ComponentInternalInstance,
  currentInstance,
  isKeepAlive,
  isVNode,
  resolveDynamicComponent,
  setCurrentRenderingInstance,
} from '@vue/runtime-dom'
import { insert, isBlock } from './block'
import {
  type VaporComponentInstance,
  createComponentWithFallback,
  emptyContext,
} from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import { type RawSlots, getScopeOwner } from './componentSlots'
import {
  insertionAnchor,
  insertionParent,
  isLastInsertion,
  resetInsertionState,
} from './insertionState'
import { advanceHydrationNode, isHydrating } from './dom/hydration'
import { DynamicFragment, type VaporFragment } from './fragment'
import type { KeepAliveInstance } from './components/KeepAlive'
import { isInteropEnabled } from './vdomInteropState'

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

  const scopeOwner = getScopeOwner()
  const renderFn = () => {
    const value = getter()
    const appContext =
      (currentInstance && currentInstance.appContext) || emptyContext
    frag.update(() => {
      // Support integration with VaporRouterView/VaporRouterLink by accepting blocks
      if (isBlock(value)) return value

      // Handles VNodes passed from VDOM components (e.g., `h(VaporComp)` from slots)
      if (isInteropEnabled && appContext.vapor && isVNode(value)) {
        if (isKeepAlive(currentInstance)) {
          const frag = (
            currentInstance as KeepAliveInstance
          ).ctx.getCachedComponent(value.type, value.key) as VaporFragment
          if (frag) return frag
        }

        const frag = appContext.vapor.vdomMountVNode(value, currentInstance)
        if (isHydrating) {
          frag.hydrate()
          if (_isLastInsertion) {
            advanceHydrationNode(_insertionParent!)
          }
        }
        return frag
      }

      return createComponentWithFallback(
        withScopeOwner(scopeOwner, () => resolveDynamicComponent(value)),
        rawProps,
        rawSlots,
        isSingleRoot,
        once,
        appContext,
      )
    }, value)
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

function withScopeOwner(owner: VaporComponentInstance | null, fn: () => any) {
  const prev = setCurrentRenderingInstance(
    owner as ComponentInternalInstance | null,
  )
  try {
    return fn()
  } finally {
    setCurrentRenderingInstance(prev)
  }
}
