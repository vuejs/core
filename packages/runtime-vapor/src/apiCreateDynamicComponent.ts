import {
  type ComponentInternalInstance,
  Fragment,
  type VNode,
  currentInstance,
  isKeepAlive,
  isVNode,
  resolveDynamicComponent,
  setCurrentRenderingInstance,
} from '@vue/runtime-dom'
import { ShapeFlags, VaporDynamicComponentFlags } from '@vue/shared'
import { insert, isBlock } from './block'
import {
  type LooseRawSlots,
  type VaporComponentInstance,
  createComponentWithFallback,
  emptyContext,
  normalizeRawSlots,
} from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import { getScopeOwner } from './componentSlots'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import {
  type HydrationCursor,
  captureHydrationCursor,
  exitHydrationCursor,
  isHydrating,
  locateHydrationNode,
} from './dom/hydration'
import { DynamicFragment, type VaporFragment } from './fragment'
import type { KeepAliveInstance } from './components/KeepAlive'
import { isInteropEnabled } from './vdomInteropState'
import { enableKeepAlive } from './keepAlive'

export function createDynamicComponent(
  getter: () => any,
  rawProps?: RawProps | null,
  rawSlots?: LooseRawSlots | null,
  flags: number = 0,
): VaporFragment {
  const isSingleRoot = !!(flags & VaporDynamicComponentFlags.SINGLE_ROOT)
  const once = !!(flags & VaporDynamicComponentFlags.ONCE)
  const slotRoot = !!(flags & VaporDynamicComponentFlags.SLOT_ROOT)
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()
  const hydrationCursor: HydrationCursor | null = isHydrating
    ? captureHydrationCursor()
    : null

  const frag =
    isHydrating || __DEV__
      ? new DynamicFragment('dynamic-component', false, true, slotRoot)
      : new DynamicFragment(undefined, false, true, slotRoot)

  const normalizedRawSlots = normalizeRawSlots(rawSlots)
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
          enableKeepAlive()
          const frag = (
            currentInstance as KeepAliveInstance
          ).ctx.getCachedComponent(value.type, value.key) as VaporFragment
          if (frag) return frag
        }

        const frag = appContext.vapor.vdomMountVNode(value, currentInstance)
        if (isHydrating) {
          locateHydrationNode(shouldConsumeFragmentStart(value))
          frag.hydrate()
        }
        return frag
      }

      return createComponentWithFallback(
        withScopeOwner(scopeOwner, () => resolveDynamicComponent(value)),
        rawProps,
        normalizedRawSlots,
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
    exitHydrationCursor(hydrationCursor)
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

function shouldConsumeFragmentStart(vnode: VNode): boolean {
  if (vnode.type === Fragment) {
    return false
  }

  // Only Vapor component VNodes carry `__multiRoot`
  // e.g. `h(VaporComp)`
  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    const type = vnode.type as { __vapor?: boolean; __multiRoot?: boolean }
    return !!type.__vapor && !type.__multiRoot
  }

  return true
}
