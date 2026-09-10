import {
  type ComponentInternalInstance,
  type GenericAppContext,
  NULL_DYNAMIC_COMPONENT,
  currentInstance,
  isVNode,
  resolveDynamicComponent,
  setCurrentRenderingInstance,
  warn,
} from '@vue/runtime-dom'
import { Namespaces, VaporDynamicComponentFlags } from '@vue/shared'
import { type Block, isBlock, removeNode } from './block'
import {
  type VaporComponentInstance,
  createComponentWithFallback,
  emptyContext,
} from './component'
import { renderEffect } from './renderEffect'
import type { RawProps } from './componentProps'
import {
  type LooseRawSlots,
  getScopeOwner,
  normalizeRawSlots,
} from './componentSlots'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import {
  type HydrationCursor,
  captureHydrationCursor,
  enterHydrationCursor,
  isHydrating,
  locateHydrationNode,
} from './dom/hydration'
import { DynamicFragment, finishBlockCreation } from './fragment'
import { isInteropEnabled } from './vdomInteropState'

export function createDynamicComponent(
  getter: () => any,
  rawProps?: RawProps | null,
  rawSlots?: LooseRawSlots | null,
  flags: number = 0,
  key?: () => any,
): Block {
  const isSingleRoot = !!(flags & VaporDynamicComponentFlags.SINGLE_ROOT)
  const once = !!(flags & VaporDynamicComponentFlags.ONCE)
  const slotRoot = !!(flags & VaporDynamicComponentFlags.SLOT_ROOT)
  const ns =
    flags & VaporDynamicComponentFlags.NS_SVG
      ? Namespaces.SVG
      : flags & VaporDynamicComponentFlags.NS_MATHML
        ? Namespaces.MATH_ML
        : undefined
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()

  const normalizedRawSlots = normalizeRawSlots(rawSlots)
  const scopeOwner = getScopeOwner()

  const render = (
    value: any,
    resolved: any,
    appContext: GenericAppContext,
  ): Block => {
    // Support integration with VaporRouterView/VaporRouterLink by accepting blocks
    if (isBlock(value)) return value

    // vnodes handed down from vdom slots (`h(VaporComp)`) mount through the
    // interop, which owns their KeepAlive lookup, fallthrough and hydration
    if (isInteropEnabled && appContext.vdom && isVNode(value)) {
      return appContext.vdom.mountVNode(value, currentInstance, isSingleRoot)
    }

    return createComponentWithFallback(
      resolved,
      rawProps,
      normalizedRawSlots,
      isSingleRoot,
      once,
      ns,
      appContext,
    )
  }

  if (once) {
    // Resolved exactly once, so there is nothing for a fragment to switch:
    // render the block in place, like `createIf` once. A null component
    // renders the fallback's placeholder node.
    const hydrationCursor = isHydrating ? enterHydrationCursor() : null
    const value = getter()
    const appContext = getAppContext()
    const block = render(
      value,
      resolveValue(value, appContext, scopeOwner),
      appContext,
    )
    finishBlockCreation(
      block,
      undefined,
      hydrationCursor,
      _insertionParent,
      _insertionAnchor,
    )
    return block
  }

  const hydrationCursor: HydrationCursor | null = isHydrating
    ? captureHydrationCursor()
    : null

  const frag = new DynamicFragment(
    0,
    __DEV__ ? 'dynamic-component' : undefined,
    false,
    slotRoot,
    slotRoot
      ? () => {
          // A single-node block (e.g. a router view block) sits in `nodes`
          // in addition to the DynamicFragment anchor. Remove both so slot
          // fallback does not expose it as content.
          const nodes = frag.nodes
          if (nodes instanceof Node) {
            const parent = nodes.parentNode
            if (parent) removeNode(nodes, parent)
          }
          const anchorParent = frag.anchor.parentNode
          if (anchorParent) removeNode(frag.anchor, anchorParent)
        }
      : undefined,
    _insertionAnchor,
  )
  if (isHydrating) locateHydrationNode()

  // A `:key` joins the resolved component in the branch identity, the way a
  // vnode is matched by type and key. The pair is memoized as one token so
  // unchanged inputs compare equal by reference.
  let lastKey: any
  let lastResolved: any
  let branchToken: object | undefined

  renderEffect(() => {
    const value = getter()
    const userKey = key ? key() : undefined
    const appContext = getAppContext()
    // Resolve before update: a null dynamic component is an empty branch
    // (nodes stays EMPTY_BLOCK, the fragment anchor is the only structural
    // node), the same shape as v-if=false. Rendering a fake placeholder node
    // instead would put a build-dependent node (dev comment / prod text) into
    // the semantic content tree — prod hydration then mistakes the detached
    // text for valid content and crashes deriving an anchor from it.
    const resolved = resolveValue(value, appContext, scopeOwner)
    if (resolved === NULL_DYNAMIC_COMPONENT) {
      frag.update(undefined, resolved)
      return
    }
    let branchKey: any = resolved
    if (key) {
      if (userKey !== lastKey || resolved !== lastResolved) {
        lastKey = userKey
        lastResolved = resolved
        branchToken = {}
      }
      branchKey = branchToken
    }
    // update() returns early on an unchanged key; skip building the branch
    // closure for it. Hydration still goes through update for its anchor.
    if (branchKey === frag.current && !isHydrating) return
    frag.update(
      () => render(value, resolved, appContext),
      branchKey,
      false,
      userKey,
    )
  })

  finishBlockCreation(
    frag,
    frag.anchor,
    hydrationCursor,
    _insertionParent,
    _insertionAnchor,
  )
  return frag
}

function getAppContext(): GenericAppContext {
  return (currentInstance && currentInstance.appContext) || emptyContext
}

// Blocks and vnodes are rendered as they are; anything else is a component
// definition or a name to resolve in the slot owner's context.
function resolveValue(
  value: any,
  appContext: GenericAppContext,
  scopeOwner: VaporComponentInstance | null,
): any {
  if (
    isBlock(value) ||
    (isInteropEnabled && appContext.vdom && isVNode(value))
  ) {
    return value
  }
  const resolved = withScopeOwner(scopeOwner, () =>
    resolveDynamicComponent(value),
  )
  // strings are tags, objects and functions are components, symbols are
  // vdom types the interop mounts; anything else is an empty branch
  const type = typeof resolved
  if (
    type !== 'string' &&
    type !== 'object' &&
    type !== 'function' &&
    type !== 'symbol'
  ) {
    if (__DEV__) {
      warn(`Invalid dynamic component type: ${String(resolved)} (${type})`)
    }
    return NULL_DYNAMIC_COMPONENT
  }
  return resolved
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
