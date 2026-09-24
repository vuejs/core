import {
  type App,
  type ComponentInternalInstance,
  type ConcreteComponent,
  type ElementNamespace,
  Fragment,
  type FunctionalComponent,
  type HydrationRenderer,
  type KeepAliveContext,
  MoveType,
  type Plugin,
  type RendererInternals,
  type ShallowRef,
  type Slot,
  type Slots,
  Static,
  type SuspenseBoundary,
  type TransitionElement,
  type TransitionHooks,
  type VNode,
  type VNodeArrayChildren,
  Comment as VNodeComment,
  type VNodeHook,
  type VNodeNormalizedRef,
  type VaporInVdomInterface,
  VaporSlot as VaporSlotVNode,
  type VdomInVaporInterface,
  type VdomSlotOptions,
  type VdomSlotOutlet,
  cloneVNode,
  createCommentVNode,
  createInternalObject,
  createVNode,
  currentInstance,
  ensureHydrationRenderer,
  ensureRenderer,
  ensureValidVNode,
  getContainerType,
  getInheritedScopeIds,
  getTransitionRawChildren,
  invokeDirectiveHook,
  invokeSlotFallback,
  invokeVNodeHook,
  isAsyncWrapper,
  isEmitListener,
  isKeepAlive,
  isVNode,
  isHydrating as isVdomHydrating,
  isHydratingEnabled as isVdomHydratingEnabled,
  leaveCbKey,
  normalizeRef,
  normalizeVNode,
  onScopeDispose,
  prepareTransitionLeave,
  prepareTransitionSwitch,
  queuePostFlushCb,
  queuePostRenderEffect,
  rawVaporSlotKey,
  renderSlot,
  resolveTransitionChild,
  restoreCurrentInstance,
  setCurrentInstance,
  setTransitionHooks as setVNodeTransitionHooks,
  shallowReactive,
  shallowRef,
  shouldUpdateComponent,
  simpleSetCurrentInstance,
  activate as vdomActivate,
  deactivate as vdomDeactivate,
  setRef as vdomSetRef,
  warn,
  withCtx,
} from '@vue/runtime-dom'
import { effectScope } from '@vue/reactivity'
import {
  type LooseRawProps,
  type VaporComponent,
  VaporComponentInstance,
  createComponent,
  getRootElement,
  isVaporComponent,
  mountComponent,
  resolveFallthroughAttrs,
  resolveFallthroughOwner,
  unmountComponent,
} from './component'
import {
  collectRootScopeIds,
  getCurrentScopeId,
  setPublishInteropScopeIds,
} from './scopeId'
import { setVarsOnBlock } from './helpers/useCssVars'
import type { LooseRawSlots } from './componentSlots'
import {
  type Block,
  type BlockFn,
  EMPTY_BLOCK,
  type VaporTransitionHooks,
  insert,
  isValidBlock,
  isValidSlot,
  move,
  remove,
} from './block'
import {
  EMPTY_ARR,
  EMPTY_OBJ,
  NOOP,
  PatchFlags,
  ShapeFlags,
  VaporSlotFlags,
  extend,
  isArray,
  isForwardedSlot,
  isFunction,
  isObject,
  isReservedProp,
  isString,
  slotInheritsFallback,
  slotNotifiesBoundary,
} from '@vue/shared'
import {
  type RawProps,
  rawPropsProxyHandlers,
  setupPropsValidation,
} from './componentProps'
import type { RawSlots, VaporSlot } from './componentSlots'
import { dynamicSlotsProxyHandlers, getSlot } from './componentSlots'
import { inOnce, withOnce } from './once'
import { renderEffect } from './renderEffect'
import { createTextNode, parentNode } from './dom/node'
import { optimizePropertyLookup } from './dom/prop'
import {
  advanceHydrationNode,
  claimAnchor,
  claimUntrackedAnchor,
  createFragmentClaim,
  currentHydrationNode,
  isComment,
  isHydrating,
  isHydratingSlotFallback,
  isRangeEnd,
  isRangeStart,
  locateEndAnchor,
  locateFragmentEnd,
  locateHydrationNode,
  runWithoutHydration,
  setCurrentHydrationNode,
  hydrateNode as vaporHydrateNode,
} from './dom/hydration'
import {
  type DynamicFragment,
  RenderContextFragment,
  type SlotFragment,
  type VaporFragment,
  createSlotBoundary,
  isFragment,
  isSlotResolver,
  resolveFragmentAnchor,
} from './fragment'
import { SLOT_OUTLET, VDOM } from './fragmentFlags'
import {
  type SlotBoundaryContext,
  hasSlotFallback,
  registerContentInvalid,
  trackSlotBoundaryDirtying,
  withSlotBoundary,
} from './slotBoundary'
import {
  type SlotResolutionState,
  disposeSlotResolution,
  insertActiveSlotFallback,
  invalidateExposedSlotContent,
  leaveSlotFallback,
  markSlotResolutionDirty,
  recheckSlotResolution,
  resolveExposedSlotNodes,
} from './slotFragment'
import {
  type SlotFallbackRange,
  currentSlotEndAnchor,
  hydrateSlotFallbackRange,
  insertUntrackedAnchor,
  withHydratingSlotBoundary,
} from './dom/hydrateFragment'
import type { NodeRef } from './apiTemplateRef'
import {
  ensureTransitionHooksRegistered,
  findTransitionBlock,
  getTransitionElement,
  setTransitionHooks as setVaporTransitionHooks,
} from './components/Transition'
import { isVaporTransition } from './transition'
import {
  interopKey,
  interopSlotsKey,
  setInteropEnabled,
} from './vdomInteropState'
import {
  type KeepAliveInstance,
  activate,
  deactivate,
} from './components/KeepAlive'
import {
  enableKeepAlive,
  getKeepAliveContext,
  isKeepAliveEnabled,
} from './keepAlive'
import {
  currentUnmountSuspense,
  enableSuspense,
  isSuspenseEnabled,
  resolveUnmountSuspense,
  runWithUnmountSuspense,
} from './suspense'
import {
  currentRenderContext,
  deriveSlotScopeIds,
  deriveSuspense,
  setRenderContext,
  withRenderContext,
} from './renderContext'

const EMPTY_VNODES = EMPTY_ARR as unknown as VNode[]

function getRawTransitionChild(vnode: VNode | undefined): VNode | undefined {
  if (!vnode) return
  const children = getTransitionRawChildren([vnode])
  return children.length === 1 ? children[0] : undefined
}

function isVaporTransitionHooks(
  hooks: TransitionHooks | undefined,
): hooks is VaporTransitionHooks {
  return !!hooks && (hooks as VaporTransitionHooks).__vapor === true
}

// runtime-core types `vnode.component` as its own instance; on a vapor vnode
// it holds the vapor instance, and that union is not nameable cross-package.
// The one cast, named.
function getVaporInstance(vnode: VNode): VaporComponentInstance {
  return vnode.component as any
}

function prepareInteropSlotTransition(
  frag: RenderContextFragment,
  vnode: VNode,
  forwarded: boolean,
  previous: VNode | undefined,
  resumeAfterLeave: () => void,
  delayedLeaveSource?: TransitionHooks,
): VNode | undefined {
  const transition = frag.$transition as TransitionHooks | undefined
  const instance = frag.renderInstance
  // Hooks inherited from VDOM BaseTransition already belong to its state
  // machine. Only forward them through the Vapor slot boundary.
  if (transition && !isVaporTransitionHooks(transition)) {
    setVNodeTransitionHooks(vnode, transition)
    return
  }
  // TransitionGroup owns list resolution; never collapse its VDOM fragment
  // into the single branch expected by BaseTransition.
  if (transition && transition.applyGroup) return

  // The slot can render before VaporTransition propagates its hooks, notably
  // during hydration, but a forwarded slot root must already use
  // BaseTransition's branch shape.
  if (
    !transition &&
    !(
      forwarded &&
      instance &&
      isVaporTransition(instance.type as VaporComponent)
    )
  ) {
    return
  }
  const branch = resolveTransitionChild([vnode], true)!
  if (!transition) {
    return branch
  }

  return (
    prepareTransitionSwitch(
      previous,
      branch,
      transition.props,
      transition.state,
      transition.instance,
      resumeAfterLeave,
      delayedLeaveSource || transition,
    ) || createCommentVNode()
  )
}

function getInteropTransitionType(vnode: VNode): VNode['type'] | undefined {
  const child = getRawTransitionChild(vnode)
  return child && child.type
}

// vdom represents an absent key as null, vapor as undefined
function vnodeKeyOf(vnode: VNode): VNode['key'] | undefined {
  return vnode.key ?? undefined
}

function getVNodeKey(vnode: VNode | undefined): VNode['key'] | undefined {
  const child = getRawTransitionChild(vnode)
  return child && vnodeKeyOf(child)
}

function getInteropTransitionElement(
  vnode: VNode | undefined,
): Element | undefined {
  if (!vnode) return
  const component = vnode.component as
    | ComponentInternalInstance
    | VaporComponentInstance
    | null
  if (isVaporComponent(component)) {
    const block = component.block && findTransitionBlock(component.block)
    return block && getTransitionElement(block)
  }
  if (component) {
    return getInteropTransitionElement(component.subTree)
  }
  if (vnode.el instanceof Element) {
    return vnode.el
  }
  if (vnode.type === Fragment) {
    const child = getRawTransitionChild(vnode)
    if (child) return getInteropTransitionElement(child)
  } else if (vnode.shapeFlag & ShapeFlags.TELEPORT && isArray(vnode.children)) {
    const child = resolveTransitionChild(vnode.children as VNode[])
    if (child) return getInteropTransitionElement(child)
  }
}

function filterReservedProps(props: VNode['props']): VNode['props'] {
  const filtered: VNode['props'] = {}
  for (const key in props) {
    if (!isReservedProp(key)) {
      filtered[key] = props[key]
    }
  }
  return filtered
}

// mounting vapor components and slots in vdom
const vaporInteropImpl = {
  applyCssVars(vnode, vars) {
    // a vapor slot rendered in vdom holds its block on the vnode
    setVarsOnBlock(vnode.vb || getVaporInstance(vnode).block, vars)
  },
  mount(
    vnode,
    container: ParentNode,
    anchor: Node | null,
    parentComponent,
    parentSuspense,
  ) {
    const selfAnchor = (vnode.anchor = createTextNode())
    vnode.el = selfAnchor
    container.insertBefore(selfAnchor, anchor)
    const prev = currentInstance
    simpleSetCurrentInstance(parentComponent)

    const propsRef = shallowRef(filterReservedProps(vnode.props))
    const slotsRef = shallowRef(normalizeInteropSlots(vnode.children))
    const rawSlots = createInteropRawSlots(slotsRef)

    const prevCtx = currentRenderContext
    if (__FEATURE_SUSPENSE__ && isSuspenseEnabled && parentSuspense) {
      setRenderContext(deriveSuspense(prevCtx, parentSuspense))
    }

    const dynamicPropSource: (() => any)[] & { [interopKey]?: boolean } = [
      () => propsRef.value,
    ]
    // mark as interop props
    dynamicPropSource[interopKey] = true
    // @ts-expect-error
    const instance = (vnode.component = createComponent(
      vnode.type as any as VaporComponent,
      {
        $: dynamicPropSource,
      } as RawProps,
      rawSlots,
      undefined,
      undefined,
      (parentComponent ? parentComponent.appContext : vnode.appContext) as any,
      // VDOM interop owns the explicit mount below
      true,
    ))
    instance.rawPropsRef = propsRef
    instance.rawSlotsRef = slotsRef
    const vnodeHookState = ensureVNodeHookState(instance, vnode)
    setInteropComponentScopeIds(instance, vnode)

    // copy the shape flag from the vdom component if inside a keep-alive
    if (parentComponent && isKeepAlive(parentComponent)) {
      enableKeepAlive()
      instance.shapeFlag = vnode.shapeFlag
    }

    if (vnode.transition) {
      ensureTransitionHooksRegistered()
      // Async setup resolves the block after interop mount. Apply the latest
      // hooks once the block exists, before it is inserted by mountComponent.
      ;(instance.bm ||= []).push(() => {
        const transition = vnodeHookState.vnode.transition
        if (transition) {
          setVaporTransitionHooks(instance, transition as VaporTransitionHooks)
        }
      })
    }

    setRenderContext(prevCtx)

    const rootEl = resolveInteropRootEl(instance)
    if (rootEl) {
      vnode.el = rootEl
    }
    const vnodeHooks = isAsyncWrapper(vnode) ? null : vnode.props
    // a pending async setup mounts once it settles, with whatever the parent
    // handed it meanwhile; vnode mounted then follows that mount, after the
    // component's own mounted hooks, as in VDOM
    const pendingSetup =
      __FEATURE_SUSPENSE__ &&
      isSuspenseEnabled &&
      !!instance.asyncDep &&
      !instance.asyncResolved
    if (
      pendingSetup ||
      vnode.dirs ||
      (vnodeHooks && vnodeHooks.onVnodeBeforeMount)
    ) {
      // `bm` runs after the component's own beforeMount hooks, once the block
      // exists and before it is inserted
      ;(instance.bm ||= []).push(() => {
        // the input the component mounts with
        const mountVNode = vnodeHookState.vnode
        const hooks = isAsyncWrapper(mountVNode) ? null : mountVNode.props
        if (pendingSetup) {
          const rootEl = resolveInteropRootEl(instance)
          if (rootEl) mountVNode.el = rootEl
          const mountedHook = hooks && hooks.onVnodeMounted
          if (mountedHook) {
            ;(instance.m ||= []).push(() =>
              invokeInteropVNodeHook(instance, mountedHook, mountVNode),
            )
          }
        }
        // align with VDOM: vnode beforeMount runs before directive created/beforeMount.
        invokeInteropVNodeHook(
          instance,
          hooks && hooks.onVnodeBeforeMount,
          mountVNode,
        )
        if (!mountVNode.dirs) return
        const [owner, el] = resolveInteropDirsRoot(
          instance,
          vnodeHookState,
          instance,
          getInteropDirsOwner(vnodeHookState, instance, mountVNode),
        )
        if (el) {
          mountInteropDirsRoot(instance, owner, el)
          mountVNode.el = el
        } else if (__DEV__) {
          warnNonElementRootDirs()
        }
      })
    }
    if (vnode.dirs) {
      ;(instance.bum ||= []).push(() =>
        unmountInteropDirs(instance, vnodeHookState, instance),
      )
    }

    mountComponent(instance, container, selfAnchor)
    if (!pendingSetup) {
      queueInteropVNodeHook(
        instance,
        vnodeHooks && vnodeHooks.onVnodeMounted,
        vnode,
        parentSuspense,
      )
    }

    simpleSetCurrentInstance(prev)
    return instance
  },

  update(n1, n2, shouldUpdate) {
    n2.component = n1.component
    n2.el = n1.el
    n2.anchor = n1.anchor

    const instance = getVaporInstance(n2)
    const vnodeHookState = ensureVNodeHookState(instance, n2)

    if (shouldUpdate) {
      const rootEl = getRootElement(instance)
      if (rootEl) {
        n2.el = rootEl
      }
      if (n2.transition && instance.block) {
        ensureTransitionHooksRegistered()
        setVaporTransitionHooks(instance, n2.transition as VaporTransitionHooks)
      }
      updateInteropVNode(instance, vnodeHookState, n2, n1)
    }
  },

  unmount(vnode, doRemove, parentSuspense) {
    if (
      __FEATURE_SUSPENSE__ &&
      isSuspenseEnabled &&
      currentUnmountSuspense !== parentSuspense
    ) {
      runWithUnmountSuspense(parentSuspense, () =>
        vaporInteropImpl.unmount(vnode, doRemove, parentSuspense),
      )
      return
    }

    const container = doRemove ? vnode.anchor!.parentNode : undefined
    const instance = getVaporInstance(vnode)
    let slotStartAnchor: Node | null = null
    if (instance) {
      const anchor = vnode.anchor as Node | null
      const vnodeHooks = isAsyncWrapper(vnode) ? null : vnode.props
      invokeInteropVNodeHook(
        instance,
        vnodeHooks && vnodeHooks.onVnodeBeforeUnmount,
        vnode,
      )
      if (instance.block) {
        unmountComponent(instance, container, parentSuspense)
        if (!doRemove) {
          // When the surrounding VDOM fragment owns DOM removal, we still need
          // to dispose the vapor-returned block tree so nested interop state
          // (for example forwarded VDOM slots or nested KeepAlive cleanup)
          // does not stay subscribed.
          const blockContainer = needsHostParentForRemove(instance.block)
            ? ((anchor && anchor.parentNode) as ParentNode)
            : undefined
          remove(instance.block, blockContainer)
        }
      } else {
        unmountComponent(instance, container, parentSuspense)
        if (!doRemove) {
          // VDOM retains the enclosing range through vnode.el and vnode.anchor.
          instance.pendingBlock = undefined
        }
      }
      queueInteropVNodeHook(
        instance,
        vnodeHooks && vnodeHooks.onVnodeUnmounted,
        vnode,
        parentSuspense,
      )
    } else if (vnode.vb) {
      const anchor = vnode.anchor as Node | null
      // `hydrateSlot()` records the opening marker for VDOM SSR slot fragments
      // on vnode.el while vnode.anchor points at the closing marker.
      if (vnode.el && vnode.el !== anchor && isRangeStart(vnode.el as Node)) {
        slotStartAnchor = vnode.el as Node
      }
      // Fragment child unmounts invoke VaporSlot with doRemove = false, so the
      // renderer does not pass us a container. Most slot blocks can still
      // clean themselves up without it, but KeepAlive needs the host container
      // to remove its current block and reach nested Teleport cleanup.
      const blockContainer =
        container ||
        (needsHostParentForRemove(vnode.vb)
          ? ((anchor && anchor.parentNode) as ParentNode)
          : undefined)
      stopVaporSlotScope(vnode)
      remove(vnode.vb, blockContainer)
    }
    if (doRemove) {
      if (slotStartAnchor) {
        const parent = slotStartAnchor.parentNode
        if (parent) {
          remove(slotStartAnchor, parent)
        }
      }
      const anchor = vnode.anchor as Node
      // `container` is captured before unmount starts, but the unmount above
      // may already remove or move this anchor. Only remove it if it is still
      // attached, using its current parent instead of the stale snapshot.
      const parent = anchor.parentNode
      if (parent) {
        remove(anchor, parent)
      }
    }
  },

  /**
   * vapor slot in vdom
   */
  slot(
    n1: VNode | null,
    n2: VNode,
    container: ParentNode,
    anchor: Node | null,
    parentComponent,
    parentSuspense,
    slotScopeIds,
  ) {
    if (!n1) {
      // mount
      const slotBlock = renderVaporSlot(
        n2,
        parentComponent,
        parentSuspense,
        slotScopeIds,
      )
      const selfAnchor =
        // use fragment's anchor when possible
        (isFragment(slotBlock) ? slotBlock.anchor : undefined) ||
        createTextNode()
      insert((n2.el = n2.anchor = selfAnchor), container, anchor)
      insert((n2.vb = slotBlock), container, selfAnchor, parentSuspense)
    } else {
      // update
      // slot function changed (e.g. dynamic slots from _createForSlots),
      // need to re-mount the vapor block
      const needsRemount =
        !n1.vs ||
        !n2.vs ||
        !n1.vs.slot ||
        !n2.vs.slot ||
        n2.vs.slot !== n1.vs.slot
      if (needsRemount) {
        const selfAnchor = n1.anchor as Node
        const parent = selfAnchor.parentNode as ParentNode
        const nextSibling = selfAnchor.nextSibling
        const rangeStartAnchor =
          n1.el && n1.el !== selfAnchor && isRangeStart(n1.el as Node)
            ? (n1.el as Node)
            : undefined
        const oldBlockOwnsAnchor =
          isFragment(n1.vb!) && n1.vb!.anchor === selfAnchor
        // remove old vapor block
        stopVaporSlotScope(n1)
        remove(n1.vb!, parent)
        const slotBlock = renderVaporSlot(
          n2,
          parentComponent,
          parentSuspense,
          slotScopeIds,
        )
        let newAnchor = isFragment(slotBlock) ? slotBlock.anchor : undefined
        let insertAnchor = nextSibling as Node
        if (newAnchor) {
          if (!oldBlockOwnsAnchor) {
            remove(selfAnchor, parent)
          }
        } else if (oldBlockOwnsAnchor) {
          newAnchor = createTextNode()
        } else {
          newAnchor = selfAnchor
          insertAnchor = selfAnchor
        }
        insert((n2.anchor = newAnchor), parent, insertAnchor)
        n2.el = rangeStartAnchor || newAnchor
        insert((n2.vb = slotBlock), parent, newAnchor, parentSuspense)
      } else {
        const vs1 = n1.vs!
        const vs2 = n2.vs!
        n2.el = n1.el
        n2.anchor = n1.anchor
        n2.vb = n1.vb
        ;(vs2.ref = vs1.ref)!.value = n2.props
        vs2.scope = vs1.scope
        syncInteropVaporSlotState(n1, n2)
      }
    }
  },

  move(
    vnode,
    container: ParentNode,
    anchor: Node | null,
    moveType,
    parentSuspense,
  ) {
    const block = vnode.vb || (vnode.component as any)
    // Resolved Vapor blocks exclude the VDOM-owned opening marker, but a
    // pending hydration range includes it. Avoid moving `vnode.el` twice.
    const pendingRangeOwnsFragmentStart =
      isVaporComponent(block) && !!block.pendingBlock
    if (
      vnode.el &&
      vnode.el !== vnode.anchor &&
      isRangeStart(vnode.el as Node) &&
      !pendingRangeOwnsFragmentStart
    ) {
      move(
        vnode.el as any,
        container,
        anchor,
        moveType,
        undefined,
        parentSuspense,
      )
    }
    move(block, container, anchor, moveType, undefined, parentSuspense)
    move(
      vnode.anchor as any,
      container,
      anchor,
      moveType,
      undefined,
      parentSuspense,
    )
  },

  hydrate(
    vnode,
    node: Node,
    container: ParentNode,
    anchor: Node | null,
    parentComponent,
    parentSuspense,
  ) {
    // Check vapor's isHydrating (for createVaporSSRApp) and VDOM's
    // isVdomHydrating (for createSSRApp). isVdomHydratingEnabled covers
    // deferred hydration (async chunks, lazy hydration strategies), which
    // runs after the root hydration pass has reset isVdomHydrating.
    // In CSR (createApp/createVaporApp + vaporInteropPlugin), all are false,
    // so this logic is tree-shaken.
    if (!isHydrating && !isVdomHydrating && !isVdomHydratingEnabled) {
      return node
    }
    let instance: VaporComponentInstance | undefined
    vaporHydrateNode(node, () => {
      instance = this.mount(
        vnode,
        container,
        anchor,
        parentComponent,
        parentSuspense,
      ) as VaporComponentInstance
    })
    if (instance && instance.asyncDep && !instance.asyncResolved) {
      // `block` stays null until async setup resolves. VDOM still needs
      // `vnode.el` as the host start node; `pendingBlock` owns the full range.
      vnode.el = node
    }
    return anchor
  },

  hydrateSlot(
    vnode,
    node: Node,
    parentComponent,
    parentSuspense,
    slotScopeIds,
  ) {
    if (!isHydrating && !isVdomHydrating && !isVdomHydratingEnabled) {
      return node
    }
    // `<!--(-->`: the server rendered the fallback of the slot's own outlet in
    // its place. Otherwise it may have rendered nothing for the slot: the
    // cursor rests on the close marker of the slot's own empty range, or of
    // the vdom fragment it ends. Either way the slot itself has nothing to
    // adopt, and an empty branch inside must not take that marker for its own
    // anchor: mount in place.
    const isFallbackRange = isComment(node, '(')
    const close = isFallbackRange
      ? locateEndAnchor(node)!
      : isRangeEnd(node)
        ? node
        : isRangeStart(node) && node.nextSibling && isRangeEnd(node.nextSibling)
          ? node.nextSibling
          : null
    if (close) {
      const ownsRange = close !== node
      mountSlotWithoutHydration(
        vnode,
        ownsRange ? node : null,
        close,
        parentComponent,
        parentSuspense,
        slotScopeIds,
        isFallbackRange
          ? { depth: 0, first: node.nextSibling!, close }
          : undefined,
      )
      return ownsRange ? close.nextSibling : close
    }
    const container = parentNode(node)!
    let createdAnchor = false
    let resumeNode: Node | null = null
    vaporHydrateNode(node, () => {
      vnode.vb = renderVaporSlot(
        vnode,
        parentComponent,
        parentSuspense,
        slotScopeIds,
      )
      const fragmentAnchor = isFragment(vnode.vb) && vnode.vb.anchor
      let anchor = fragmentAnchor || currentHydrationNode!
      const wrapped = isRangeStart(node) && isRangeEnd(anchor)
      // An unwrapped slot has no SSR-owned boundary. The hydration cursor is
      // only where VDOM should resume and may belong to the next sibling, so
      // create a dedicated self anchor matching the mount path.
      if (!fragmentAnchor && !wrapped) {
        createdAnchor = true
        resumeNode = anchor && parentNode(anchor) === container ? anchor : null
        anchor = createTextNode()
        container.insertBefore(anchor, resumeNode)
      }
      // VDOM SSR wraps slot output in fragment anchors. Keep that range on the
      // VaporSlot vnode so enabled Teleport removal can dispose both anchors.
      if (isRangeStart(node) && isRangeEnd(anchor)) {
        vnode.el = node
        vnode.anchor = anchor
      } else {
        vnode.anchor = vnode.el = anchor
      }
      if (__DEV__ && !vnode.anchor) {
        throw new Error(
          `Failed to locate slot anchor. this is likely a Vue internal bug.`,
        )
      }
    })
    // The created anchor is a client-only node; returning it would make
    // hydrateChildren() treat it as an unclaimed server-rendered child.
    if (createdAnchor) return resumeNode
    // For fragment-wrapped slot content (`<!--[-->...<!--]-->`), return the
    // node after the end anchor to avoid hydrateChildren() treating `<!--]-->`
    // as an extra child of the current container.
    return isRangeStart(node)
      ? (vnode.anchor as Node).nextSibling
      : (vnode.anchor as Node)
  },

  hydrateSlotOutlet(
    outlet,
    open: Comment,
    parentComponent,
    parentSuspense,
    slotScopeIds,
  ) {
    if (!isHydrating && !isVdomHydrating && !isVdomHydratingEnabled) {
      return open.nextSibling
    }
    return hydrateOutletFallback(
      outlet.children as VNode[],
      open.nextSibling!,
      locateEndAnchor(open)!,
      0,
      parentComponent,
      parentSuspense,
      slotScopeIds,
    )
  },

  attachSlotOutlet,

  setTransitionHooks(component, hooks) {
    ensureTransitionHooksRegistered()
    setVaporTransitionHooks(component as any, hooks as VaporTransitionHooks)
  },

  activate(
    vnode,
    container: ParentNode,
    anchor: Node | null,
    parentComponent,
    parentSuspense,
  ) {
    const cached = (parentComponent.ctx as KeepAliveContext).getCachedComponent(
      vnode,
    )
    vnode.el = cached.el
    vnode.component = cached.component
    vnode.anchor = cached.anchor
    const instance = getVaporInstance(vnode)
    const vnodeHookState = ensureVNodeHookState(instance, vnode)
    const rootEl = getRootElement(instance)
    if (rootEl) {
      vnode.el = rootEl
    }
    if (__DEV__ && vnode.dirs && !rootEl) warnNonElementRootDirs()
    const shouldUpdate = shouldUpdateComponent(cached, vnode)
    if (shouldUpdate) {
      updateInteropVNode(instance, vnodeHookState, vnode, cached)
    }
    activate(instance, container, anchor, parentSuspense)
    insert(vnode.anchor as any, container, anchor)
    queueInteropVNodeHook(
      instance,
      vnode.props && vnode.props.onVnodeMounted,
      vnode,
      parentSuspense,
    )
  },

  deactivate(vnode, container: ParentNode, parentSuspense) {
    const instance = getVaporInstance(vnode)
    deactivate(instance, container, parentSuspense)
    insert(vnode.anchor as any, container)
    queueInteropVNodeHook(
      instance,
      vnode.props && vnode.props.onVnodeUnmounted,
      vnode,
      parentSuspense,
    )
  },
} satisfies VaporInVdomInterface

const vaporSlotPropsProxyHandler: ProxyHandler<
  ShallowRef<Record<string, any>>
> = {
  get(target, key: any) {
    return target.value[key]
  },
  has(target, key: any) {
    return key in target.value
  },
  ownKeys(target) {
    return Reflect.ownKeys(target.value)
  },
  getOwnPropertyDescriptor(target, key: any) {
    if (key in target.value) {
      return {
        enumerable: true,
        configurable: true,
      }
    }
  },
}

// Cache wrappers per raw slots object so repeated `slots.default` access keeps
// a stable function identity
const vaporSlotWrappersCache = new WeakMap<
  object,
  Map<PropertyKey, { slot: Function; wrapped: Function }>
>()

const vaporSlotsProxyHandler: ProxyHandler<any> = {
  get(target, key) {
    const slot =
      isString(key) && !isInternalSlotKey(key)
        ? getSlot(target, key)
        : target[key]
    if (isFunction(slot)) {
      ;(slot as any)[rawVaporSlotKey] = slot
      let wrappers = vaporSlotWrappersCache.get(target)
      if (!wrappers) vaporSlotWrappersCache.set(target, (wrappers = new Map()))
      const cached = wrappers.get(key)
      if (cached && cached.slot === slot) {
        return cached.wrapped
      }

      // Create a wrapper that internally uses renderSlot for proper vapor slot handling
      // This ensures that calling slots.default() works the same as renderSlot(slots, 'default')
      const wrapped = (props?: Record<string, any>) => [
        renderSlot({ [key]: slot }, key as string, props),
      ]
      ;(wrapped as any)[rawVaporSlotKey] = slot
      // already normalized, so VDOM slot normalization keeps it as is
      ;(wrapped as any)._n = true
      wrappers.set(key, { slot, wrapped })
      return wrapped
    }
    return slot
  },
  ownKeys(target) {
    return Array.from(dynamicSlotsProxyHandlers.ownKeys!(target)).filter(
      key => isString(key) && !isInternalSlotKey(key),
    )
  },
  getOwnPropertyDescriptor(target, key) {
    if (!isString(key) || isInternalSlotKey(key)) return
    return dynamicSlotsProxyHandlers.getOwnPropertyDescriptor!(target, key)
  },
}

let vdomHydrateNode: HydrationRenderer['hydrateNode'] | undefined

// Static/Fragment/Teleport vnodes represent a root range [el..anchor].
// Component roots can update internally, so resolve through the current subtree.
function resolveVNodeRange(vnode: VNode): [Node, Node] | undefined {
  const { type, shapeFlag, el, anchor } = vnode
  if (shapeFlag & ShapeFlags.TELEPORT && el && anchor && anchor !== el) {
    return [el as Node, anchor as Node]
  }

  // Empty Fragments can expose only an anchor; include it so parked invalid
  // VNode slot content can be detached from the real DOM.
  if ((type === Static || type === Fragment) && anchor) {
    return el && anchor !== el
      ? [el as Node, anchor as Node]
      : [anchor as Node, anchor as Node]
  }
  if (shapeFlag & ShapeFlags.COMPONENT) {
    const subTree = vnode.component && vnode.component.subTree
    if (subTree) {
      return resolveVNodeRange(subTree)
    }
  }
}

function resolveVNodeNodes(vnode: VNode): Block {
  // Vapor component VNodes expose only their first root on `vnode.el`.
  // Use the mounted block so multi-root output keeps slot anchors and other
  // trailing anchors in the resolved block shape.
  if (vnode.component && isVaporComponent(vnode.component)) {
    const block = (vnode.component as any).block as Block | undefined
    if (block) {
      const anchor = vnode.anchor
      if (anchor) return [block, anchor as Node]
      return block
    }
  }
  // Resolve through the live block so slot content and dynamic fragments stay
  // visible. Hydrated slots also retain a VDOM-owned opening marker.
  if (vnode.type === VaporSlotVNode && vnode.vb) {
    const { el, anchor, vb } = vnode
    if (!anchor) return vb

    return el && el !== anchor && isRangeStart(el as Node)
      ? [el as Node, vb, anchor as Node]
      : [vb, anchor as Node]
  }
  const vnodeRange = resolveVNodeRange(vnode)
  if (vnodeRange) {
    const nodeRange: Node[] = []
    let n: Node | null = vnodeRange[0]
    while (n) {
      nodeRange.push(n)
      if (n === vnodeRange[1]) break
      n = n.nextSibling
    }
    return nodeRange
  }
  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    const subTree = vnode.component && vnode.component.subTree
    if (subTree) {
      return resolveVNodeNodes(subTree)
    }
  }
  return vnode.el as Block
}

// Deliberately shallower than block.ts's removeAttachedNodes (which this
// local declaration shadows): interop node snapshots (resolveVNodeNodes) can
// embed live vapor component/fragment entries whose DOM teardown belongs to
// their own owners (the VDOM renderer / block removal). This detaches only
// loose top-level DOM nodes, recursing through arrays — never into block
// structures. Do not "dedupe" the two.
function removeAttachedNodes(block: Block, parent: ParentNode): void {
  if (block instanceof Node) {
    if (block.parentNode === parent) {
      remove(block, parent)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      removeAttachedNodes(block[i], parent)
    }
  }
}

function trackFragmentVNodeUpdates(
  frag: VaporFragment,
  vnode: VNode,
  syncNodes: () => void,
): void {
  // `ibu`/`iu` are the interop-internal notification channel the renderer
  // fires alongside the public vnode hooks. Assignment (never append) keeps
  // the channel single-owner: re-tracking replaces a stale callback instead
  // of accumulating, and user props stay untouched.
  vnode.ibu = () => {
    if (frag.bu) {
      frag.bu.forEach(hook => hook())
    }
  }
  vnode.iu = () => {
    syncNodes()
    if (frag.u) {
      frag.u.forEach(hook => hook(frag.nodes))
    }
  }
}

/**
 * Shared content cell for interop fragments. Hosts write the subset they
 * own — do not read a field the host does not maintain (`valid` stays false
 * where validity is derived live from the nodes; `nodes` stays EMPTY_BLOCK
 * where the fragment's own `nodes` is the snapshot).
 *
 * `resolved` implements the optimistic-validity rule every interop fragment
 * shares: nodes stay unresolved until the first sync (on insert / after
 * patch), and validity reports true until then to keep a host boundary from
 * mounting its fallback before the content exists. This keeps the common
 * (valid) case free — an empty result is corrected later when the resolve
 * path notifies the boundary to recheck; starting invalid would instead
 * mount-then-teardown the fallback on every interop mount. Hydration starts
 * resolved (SSR nodes exist).
 */
class InteropContentState {
  nodes: Block = EMPTY_BLOCK
  valid = false
  resolved = isHydrating
}

function createVNodeFragment(vnode: VNode): {
  frag: RenderContextFragment<Block>
  syncNodes: () => void
} {
  const frag = createInteropFragment(EMPTY_BLOCK, vnode)
  frag.$key = vnodeKeyOf(vnode)
  const content = new InteropContentState()
  // reads `frag.vnode` rather than the captured argument so it follows a
  // fallthrough re-clone (see mountVNode)
  const syncNodes = () => {
    frag.nodes = resolveVNodeNodes(frag.vnode!)
    content.resolved = true
  }
  frag.isBlockValid = componentAsValid =>
    content.resolved ? isValidBlock(frag.nodes, componentAsValid) : true
  trackFragmentVNodeUpdates(frag, vnode, syncNodes)
  return { frag, syncNodes }
}

/**
 * Mount a vnode as a dynamic component branch (`<component :is="vnode">`
 * in a vapor template). The KeepAlive lookup, fallthrough and hydration of
 * the vnode live here so the dynamic component only sees a block.
 */
function mountDynamicVNode(
  internals: RendererInternals,
  vnode: VNode,
  parentComponent: VaporComponentInstance | null,
  isSingleRoot?: boolean,
): VaporFragment {
  if (parentComponent && isKeepAlive(parentComponent)) {
    const cached = (
      parentComponent as KeepAliveInstance
    ).ctx.getCachedComponent(vnode.type, vnode.key) as VaporFragment
    if (cached) return cached
  }
  // A vnode standing in as the parent's effective root inherits fallthrough
  // attrs merged into its props (see mountVNode).
  const owner = resolveFallthroughOwner(isSingleRoot)
  const frag = mountVNode(
    internals,
    vnode,
    parentComponent,
    owner && (() => resolveFallthroughAttrs(owner)),
  )
  if (isHydrating) {
    locateHydrationNode(
      shouldConsumeFragmentStart(vnode) ? createFragmentClaim() : undefined,
    )
    frag.hydrate!()
  }
  return frag
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

/**
 * Mount VNode in vapor
 */
function mountVNode(
  internals: RendererInternals,
  vnode: VNode,
  parentComponent: VaporComponentInstance | null,
  getFallthroughAttrs?: () => Record<string, any>,
): VaporFragment {
  let suspense =
    currentRenderContext.suspense ||
    (parentComponent && parentComponent.suspense)
  // A vnode standing in as a component's effective root inherits fallthrough
  // attrs the same way VDOM does it — merged into the vnode's props
  // (`cloneVNode` -> `mergeProps`), so mount and patch apply them natively
  // instead of writing the DOM behind the renderer's back.
  const baseVNode = vnode
  if (getFallthroughAttrs) {
    vnode = cloneVNode(baseVNode, getFallthroughAttrs())
  }
  const { frag, syncNodes } = createVNodeFragment(vnode)

  let isMounted = false
  let mountedParentNode: ParentNode | undefined
  let mountedAnchor: Node | null = null
  // The insertion container is the authority for the element namespace: it sees
  // through component boundaries and runtime-resolved targets, which neither a
  // compile-time constant nor a plumbed parameter can. Captured once at mount
  // and reused for later patches, mirroring how VDOM closes the mount-time
  // namespace over a component's render effect.
  let namespace: ElementNamespace
  let isUnmounted = false
  const unmount = (parentNode?: ParentNode, transition?: TransitionHooks) => {
    // scope disposal and block removal can both reach this
    if (isUnmounted) {
      if (parentNode) {
        removeAttachedNodes(resolveVNodeNodes(vnode), parentNode)
        if (vnode.anchor && vnode.anchor.parentNode === parentNode) {
          remove(vnode.anchor as Node, parentNode)
        }
      }
      return
    }
    if (transition) setVNodeTransitionHooks(vnode, transition)
    const parentSuspense = resolveUnmountSuspense(suspense)
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      const keepAliveCtx = (parentComponent as KeepAliveInstance).ctx
      keepAliveCtx.clearCurrent!(frag)
      const storageContainer = keepAliveCtx.getStorageContainer()
      if ((vnode.type as any).__vapor) {
        deactivate(vnode.component as any, storageContainer, parentSuspense)
        // Move the VNode-owned end anchor with the inner Vapor block.
        insert(vnode.anchor as Node, storageContainer)
      } else {
        vdomDeactivate(
          vnode,
          storageContainer,
          internals,
          parentComponent as any,
          parentSuspense,
        )
      }
    } else {
      isUnmounted = true
      internals.um(vnode, parentComponent as any, parentSuspense, !!parentNode)
    }

    if (vnode.anchor && parentNode && vnode.anchor.parentNode === parentNode) {
      remove(vnode.anchor as Node, parentNode)
    }
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    hydrateVNode(vnode, parentComponent as any, frag.slotScopeIds)
    isMounted = true
    syncNodes()
  }

  const place = (
    parentNode: ParentNode,
    anchor: Node | null,
    parentSuspense: SuspenseBoundary | null | undefined,
    transition: TransitionHooks | undefined,
    moveType = MoveType.REORDER,
  ) => {
    if (isHydrating) return
    if (parentSuspense !== undefined) suspense = parentSuspense
    const operationSuspense = suspense
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      if ((vnode.type as any).__vapor) {
        activate(vnode.component as any, parentNode, anchor, operationSuspense)
        insert(vnode.anchor as Node, parentNode, anchor)
      } else {
        vdomActivate(
          vnode,
          parentNode,
          anchor,
          internals,
          parentComponent as any,
          operationSuspense,
          undefined,
          false,
        )
      }
      return
    } else {
      const prev = currentInstance
      simpleSetCurrentInstance(parentComponent)
      if (!isMounted) {
        if (transition) setVNodeTransitionHooks(vnode, transition)
        namespace = getContainerType(parentNode as Element)
        internals.p(
          null,
          vnode,
          parentNode,
          anchor,
          parentComponent as any,
          operationSuspense,
          namespace,
          frag.slotScopeIds,
        )
        isMounted = true
      } else {
        // move
        if (transition && moveType !== MoveType.REORDER) {
          setVNodeTransitionHooks(vnode, transition)
        }
        internals.m(
          vnode,
          parentNode,
          anchor,
          moveType,
          parentComponent as any,
          operationSuspense,
        )
      }
      simpleSetCurrentInstance(prev)
      mountedParentNode = parentNode
      mountedAnchor = anchor
    }
    syncNodes()
    if (isMounted && frag.u) frag.u.forEach(hook => hook(frag.nodes))
  }
  frag.insert = (parentNode, anchor, parentSuspense, transition) =>
    place(parentNode, anchor, parentSuspense, transition)
  frag.move = (
    parentNode,
    anchor,
    moveType,
    _parentComponent,
    parentSuspense,
    transition,
  ) => place(parentNode, anchor, parentSuspense, transition, moveType)

  if (getFallthroughAttrs) {
    // Re-clone and let VDOM patch the change through, mirroring how a VDOM
    // parent re-renders its root with fresh fallthrough attrs. The first run
    // only establishes the dependency — the initial clone above already
    // carries those attrs into the mount.
    let applied = false
    renderEffect(() => {
      // clone on every run: merging the attrs is what reads them, and that
      // read is the dependency this effect tracks
      const next = cloneVNode(baseVNode, getFallthroughAttrs())
      if (!applied) {
        // the eager clone above already carries these attrs into the mount
        applied = true
        return
      }
      if (!isMounted || !mountedParentNode) return
      const previous = vnode
      vnode = next
      trackFragmentVNodeUpdates(frag, vnode, syncNodes)
      frag.vnode = vnode
      frag.$key = vnodeKeyOf(vnode)
      const prevInstance = currentInstance
      simpleSetCurrentInstance(parentComponent)
      internals.p(
        previous,
        vnode,
        mountedParentNode,
        mountedAnchor,
        parentComponent as any,
        suspense,
        namespace,
        frag.slotScopeIds,
      )
      simpleSetCurrentInstance(prevInstance)
      syncNodes()
    })
  }

  frag.remove = unmount
  return frag
}

/**
 * Mount vdom component in vapor
 */
function createVDOMComponent(
  internals: RendererInternals,
  component: ConcreteComponent,
  parentComponent: VaporComponentInstance | null,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  once?: boolean,
): VaporFragment {
  let suspense =
    currentRenderContext.suspense ||
    (parentComponent && parentComponent.suspense)
  const useBridge = shouldUseRendererBridge(component)
  const comp = useBridge ? ensureRendererBridge(component) : component
  const vnode = createVNode(
    comp,
    rawProps && extend({}, new Proxy(rawProps, rawPropsProxyHandlers)),
  )
  const { frag, syncNodes } = createVNodeFragment(vnode)
  const keepAliveCtx = isKeepAliveEnabled
    ? (getKeepAliveContext(parentComponent) as KeepAliveInstance['ctx'] | null)
    : null

  if (keepAliveCtx) {
    keepAliveCtx.processShapeFlag(frag)
    // for VDOM async components, trigger cacheBlock after resolution
    if ((component as any).__asyncLoader) {
      // guard against stale resolution after unmount or branch switch
      let disposed = false
      onScopeDispose(() => (disposed = true))
      ;(component as any)
        .__asyncLoader()
        .then(() => {
          if (!disposed) keepAliveCtx.cacheBlock(frag)
        })
        .catch(NOOP)
    }
  }

  if (
    !once &&
    (component as any).__asyncLoader &&
    rawSlots &&
    (rawSlots as RawSlots).$
  ) {
    // the async wrapper passes slots to its inner component only when it
    // renders, so re-render it when dynamic slots change, like a VDOM parent
    renderEffect(() => {
      dynamicSlotsProxyHandlers.ownKeys!(rawSlots as RawSlots)
      const instance = vnode.component
      if (instance && instance.isMounted) instance.update()
    }, true)
  }

  // overwrite how the vdom instance handles props
  vnode.vi = (instance: ComponentInternalInstance) => {
    // Reuse VDOM's normalized options so Options API merging stays in VDOM.
    const wrapper = new VaporComponentInstance<Record<string, unknown>>(
      useBridge
        ? (comp as any)
        : {
            props: instance.propsOptions[0],
            __propsOptions: instance.propsOptions,
          },
      rawProps as RawProps,
      rawSlots as RawSlots,
      parentComponent ? parentComponent.appContext : undefined,
      once,
    )

    const attrs = createInternalObject()
    const isFilteredAttr = (key: string | symbol): boolean =>
      typeof key === 'string' &&
      (isReservedProp(key) || isEmitListener(instance.emitsOptions, key))
    instance.attrs = new Proxy(attrs, {
      get(_, key: string | symbol) {
        if (isFilteredAttr(key)) return
        return wrapper.attrs[key as any]
      },
      has(_, key: string | symbol) {
        return !isFilteredAttr(key) && key in wrapper.attrs
      },
      ownKeys() {
        return Reflect.ownKeys(wrapper.attrs).filter(
          key => !isFilteredAttr(key),
        )
      },
      getOwnPropertyDescriptor(_, key: string | symbol) {
        if (!isFilteredAttr(key) && key in wrapper.attrs) {
          return {
            enumerable: true,
            configurable: true,
          }
        }
      },
    })

    // Match VDOM's optional props behavior for functional components.
    instance.props =
      vnode.shapeFlag & ShapeFlags.FUNCTIONAL_COMPONENT && !comp.props
        ? instance.attrs
        : shallowReactive(wrapper.props)

    instance.slots =
      wrapper.rawSlots === EMPTY_OBJ
        ? EMPTY_OBJ
        : new Proxy(wrapper.rawSlots, vaporSlotsProxyHandler)

    // async wrappers create the inner component with `vnode.children`
    if ((component as any).__asyncLoader && instance.slots !== EMPTY_OBJ) {
      vnode.children = instance.slots
      vnode.shapeFlag |= ShapeFlags.SLOTS_CHILDREN
    }

    if (__DEV__) {
      const prev = setCurrentInstance(wrapper, instance.scope)
      try {
        setupPropsValidation(wrapper, vnode)
      } finally {
        restoreCurrentInstance(prev)
      }
    }
  }

  let rawRef: VNodeNormalizedRef | null = null
  let isMounted = false
  let isUnmounted = false
  let isDomRemoved = false
  const removeDom = (parentNode?: ParentNode): void => {
    if (!parentNode || isDomRemoved) {
      return
    }
    removeAttachedNodes(resolveVNodeNodes(vnode), parentNode)
    isDomRemoved = true
  }
  const unmount = (parentNode?: ParentNode, transition?: TransitionHooks) => {
    if (isUnmounted) {
      if (!transition) removeDom(parentNode)
      return
    }
    // unset ref
    if (rawRef) vdomSetRef(rawRef, null, null, vnode, true)
    if (transition) setVNodeTransitionHooks(vnode, transition)
    const parentSuspense = resolveUnmountSuspense(suspense)
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      // A deactivated child is no longer patched by its parent in VDOM, so
      // pause the commit of the raw sources it reads from this Vapor parent.
      if (frag.inputScope) frag.inputScope.pause()
      keepAliveCtx!.clearCurrent!(frag)
      vdomDeactivate(
        vnode,
        keepAliveCtx!.getStorageContainer(),
        internals,
        parentComponent as any,
        parentSuspense,
      )
      return
    }
    isUnmounted = true
    isMounted = false
    if (isKeepAliveEnabled && frag.inputScope) frag.inputScope.stop()
    internals.um(vnode, parentComponent as any, parentSuspense, !!parentNode)
    // VDOM transitions own their leaving DOM until the leave finishes.
    if (!transition) removeDom(parentNode)
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    hydrateVNode(vnode, parentComponent as any, frag.slotScopeIds)
    isMounted = true
    syncNodes()
  }

  vnode.scopeId = getCurrentScopeId() || null
  vnode.slotScopeIds = currentRenderContext.slotScopeIds

  const place = (
    parentNode: ParentNode,
    anchor: Node | null,
    parentSuspense: SuspenseBoundary | null | undefined,
    transition: TransitionHooks | undefined,
    moveType = MoveType.REORDER,
  ) => {
    if (isHydrating) return
    if (parentSuspense !== undefined) suspense = parentSuspense
    const operationSuspense = suspense
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      // An activated child re-enters with the inputs its parent holds now, so
      // catch the commit up with the sources before activating.
      if (frag.inputScope) frag.inputScope.resume()
      vdomActivate(
        vnode,
        parentNode,
        anchor,
        internals,
        parentComponent as any,
        operationSuspense,
        undefined,
        false,
      )
    } else {
      const prev = currentInstance
      simpleSetCurrentInstance(parentComponent)
      if (!isMounted) {
        if (transition) setVNodeTransitionHooks(vnode, transition)
        internals.mt(
          vnode,
          parentNode,
          anchor,
          parentComponent as any,
          operationSuspense,
          getContainerType(parentNode as Element),
          false,
        )
        // set ref
        if (rawRef) vdomSetRef(rawRef, null, operationSuspense, vnode)
        isMounted = true
      } else {
        // move
        if (transition && moveType !== MoveType.REORDER) {
          setVNodeTransitionHooks(vnode, transition)
        }
        internals.m(
          vnode,
          parentNode,
          anchor,
          moveType,
          parentComponent as any,
          operationSuspense,
        )
      }
      simpleSetCurrentInstance(prev)
    }

    syncNodes()
    if (isMounted && frag.u) frag.u.forEach(hook => hook(frag.nodes))
  }
  frag.insert = (parentNode, anchor, parentSuspense, transition) =>
    place(parentNode, anchor, parentSuspense, transition)
  frag.move = (
    parentNode,
    anchor,
    moveType,
    _parentComponent,
    parentSuspense,
    transition,
  ) => place(parentNode, anchor, parentSuspense, transition, moveType)

  frag.remove = unmount

  frag.setRef = (
    instance: VaporComponentInstance,
    ref: NodeRef,
    refFor: boolean,
    refKey: string | undefined,
  ): void => {
    const oldRawRef = rawRef
    rawRef = normalizeRef(
      {
        ref: ref as any,
        ref_for: refFor,
        ref_key: refKey,
      },
      instance as any,
    )

    if (isMounted) {
      if (rawRef) {
        vdomSetRef(rawRef, oldRawRef, suspense, vnode)
      } else if (oldRawRef) {
        vdomSetRef(oldRawRef, null, null, vnode, true)
      }
    }
  }

  return frag
}

const rendererBridgeCache = new WeakMap<
  ConcreteComponent,
  FunctionalComponent
>()

/**
 * Teleport/Suspense are renderer primitives (`__isTeleport` / `__isSuspense`),
 * not regular components with their own render pipeline.
 *
 * We wrap them with a tiny functional bridge so they can pass through the
 * interop component mount path while preserving built-in vnode semantics.
 */
function shouldUseRendererBridge(
  component: ConcreteComponent & {
    __isTeleport?: boolean
    __isSuspense?: boolean
  },
): boolean {
  return !!(component.__isTeleport || component.__isSuspense)
}

function ensureRendererBridge(
  component: ConcreteComponent,
): FunctionalComponent {
  let bridge = rendererBridgeCache.get(component)
  if (!bridge) {
    rendererBridgeCache.set(
      component,
      (bridge = (props, { slots }) => createVNode(component, props, slots)),
    )
  }
  return bridge
}

function hasValidVNodeContent(vnode: VNode): boolean {
  return !!ensureValidVNode(
    vnode.type === Fragment && isArray(vnode.children)
      ? (vnode.children as VNodeArrayChildren)
      : [vnode],
  )
}

function trackSlotVNodeUpdatesWithRefresh(
  vnode: VNode,
  refresh: () => void,
  beforeUpdate?: () => void,
): void {
  // Fragment patches fire no notifications, so subscribe every top-level
  // range participant (element/component children); a component child's
  // self-update must still refresh the snapshot. cloneVNode carries the
  // fields so renderer-internal clones of mounted children keep notifying.
  const track = (node: VNode) => {
    if (beforeUpdate) node.ibu = beforeUpdate
    node.iu = refresh
    if (node.type === Fragment && isArray(node.children)) {
      node.children.forEach(child => {
        if (isVNode(child)) track(child)
      })
    }
  }

  track(vnode)
}

type SlotResolutionHooks = Pick<
  SlotResolutionState,
  | 'getContent'
  | 'getParentNode'
  | 'getAnchor'
  | 'isBusy'
  | 'isDisposed'
  | 'isContentValid'
  | 'syncNodes'
  | 'notifyExposedValidityChange'
>

/**
 * Construction point for the interop hosts' resolution state — the shared
 * bookkeeping fields plus the host-specific hooks. (SlotFragment, the third
 * host, implements SlotResolutionState directly as a class.)
 */
function createSlotResolutionState(
  boundary: SlotBoundaryContext,
  hooks: SlotResolutionHooks,
): SlotResolutionState {
  const state: SlotResolutionState = extend(
    {
      boundary,
      activeFallback: null,
      fallbackInserted: false,
      pendingRecheck: false,
      pendingRecheckForce: false,
      isReconciling: false,
    },
    hooks,
  )
  return state
}

/**
 * Exposes `$transition` through the outlet fragment so BaseTransition state
 * stays on the fragment; hooks inherited from VDOM BaseTransition are
 * filtered out on read because they belong to its own state machine.
 * Enumerable + configurable to match an object-literal accessor pair.
 */
function installInteropTransitionAccessor(
  state: SlotResolutionState,
  frag: VaporFragment,
): void {
  Object.defineProperty(state, '$transition', {
    enumerable: true,
    configurable: true,
    get(): VaporTransitionHooks | undefined {
      const transition = frag.$transition
      return transition && isVaporTransitionHooks(transition)
        ? transition
        : undefined
    },
    set(transition: VaporTransitionHooks | undefined) {
      frag.$transition = transition
    },
  })
}

interface PendingOutIn {
  content: VNode | Block | undefined
  placeholder: VNode | null
  contentValid: boolean
  leavingElement?: Element
}

/**
 * Mount vdom slot in vapor.
 *
 * The outlet's mutable state lives in locals and its units in inner
 * functions — deliberately not class members: member names are string
 * properties the minifier cannot mangle, and a class method's body survives
 * DCE even when every call site is dead (locals and inner functions mangle
 * and tree-shake fully). The flow splits along its natural axes:
 * - `renderContent` — reactive content resolution and the CSR apply paths
 * - `applyVNodeContent` / `resumeOutIn` — BaseTransition mode arbitration
 *   (out-in / in-out) between slot content and the fallback chain
 * - `hydrateContent` — the one-shot SSR range claimer
 * - fallback plumbing through slotFragment's SlotResolutionState protocol
 */
interface VaporVdomSlotOptions extends VdomSlotOptions {
  fallback?: VaporSlot
}

function renderVDOMSlot(
  internals: RendererInternals,
  slotsRef: ShallowRef<Slots>,
  name: string | (() => string),
  props: Record<string, any>,
  parentComponent: VaporComponentInstance,
  options: VaporVdomSlotOptions = EMPTY_OBJ,
): VaporFragment {
  const { fallback, flags = 0, adoptAnchor } = options
  const once = !!(flags & VaporSlotFlags.ONCE)
  const sharedFallback = !!(flags & VaporSlotFlags.SHARED_FALLBACK)
  const forwarded = isForwardedSlot(flags)
  const inheritFallback = slotInheritsFallback(flags)
  const notifiesBoundary = slotNotifiesBoundary(flags)
  let suspense = currentRenderContext.suspense || parentComponent.suspense
  // frag.slotScopeIds is the outlet's id cell (the ambient createSlot
  // establishes around this call) — the base patch context for content
  // patches.
  const frag = createInteropFragment(EMPTY_BLOCK, null, SLOT_OUTLET)
  const slotBoundary = frag.slotBoundary
  const content = new InteropContentState()
  const scope = effectScope()

  let localFallback: BlockFn | undefined
  let rendered: VNode | Block | null = null
  let isMounted = false
  let currentParentNode: ParentNode | null = null
  // Captured from the real DOM container on insert. `currentParentNode` is
  // not a safe namespace source here: it is swapped to a detached
  // DocumentFragment while content is parked for a shared fallback (see
  // `sharedContentStorage`).
  let slotNamespace: ElementNamespace
  let currentAnchor: Node | null = null
  let sharedContentStorage: DocumentFragment | undefined
  let disposed = false
  let pendingInOutVNode: VNode | undefined
  let pendingOutIn: PendingOutIn | undefined
  let isContentUpdateRecheck = false
  let slotResolutionState!: SlotResolutionState

  // `isBlockValid` reports VDOM-side validity (`content.valid`), not
  // `isValidBlock(frag.nodes)`: `frag.nodes` tracks the active fallback
  // when one is shown.
  frag.isBlockValid = componentAsValid => {
    if (!content.resolved) return true
    return slotResolutionState.activeFallback
      ? isValidBlock(slotResolutionState.activeFallback, componentAsValid)
      : content.valid
  }
  const parentBoundary = inheritFallback ? slotBoundary : null
  const boundary = createSlotBoundary(
    frag,
    () => parentBoundary,
    (): BlockFn | undefined => localFallback,
    force => markSlotResolutionDirty(slotResolutionState, force),
    [cleanupInvalidContent],
  )
  // Mirrors the vapor fast path: an outlet joining no fallback arbitration
  // renders its content outside the boundary chain, so nested outlets
  // classify identically under both hosts and validity flips inside the
  // content never notify the dead-end own boundary.
  const contentBoundary = forwarded || fallback ? boundary : null
  slotResolutionState = createSlotResolutionState(boundary, {
    getContent: () => content.nodes,
    getParentNode: () => currentParentNode,
    getAnchor: () => currentAnchor,
    isBusy: () => false,
    isDisposed: () => disposed,
    isContentValid: () => content.valid,
    syncNodes: () => {
      frag.nodes = resolveExposedSlotNodes(slotResolutionState)
    },
    notifyExposedValidityChange: () => {
      if (notifiesBoundary && !isContentUpdateRecheck && slotBoundary) {
        slotBoundary.markDirty()
      }
    },
  })
  installInteropTransitionAccessor(slotResolutionState, frag)
  if (sharedFallback && slotBoundary) {
    registerContentInvalid(slotBoundary, parkSharedContent, frag)
  }
  if (notifiesBoundary) {
    trackSlotBoundaryDirtying(
      frag,
      sharedFallback ? undefined : cleanupInvalidContent,
    )
  }
  localFallback = fallback
    ? once
      ? () => withOnce(() => fallback(internals, parentComponent))
      : () => fallback(internals, parentComponent)
    : undefined

  const place = (
    parentNode: ParentNode,
    anchor: Node | null,
    parentSuspense: SuspenseBoundary | null | undefined,
    moveType?: MoveType,
  ) => {
    if (isHydrating) return
    if (parentSuspense !== undefined) suspense = parentSuspense
    // A non-inherited local fallback can revive independently of sibling
    // roots, so it needs an insertion point separate from the enclosing slot.
    if (localFallback && !inheritFallback && !frag.anchor) {
      frag.anchor = resolveFragmentAnchor(adoptAnchor, undefined)
      if (frag.anchor !== adoptAnchor) {
        parentNode.insertBefore(frag.anchor, anchor)
      }
      anchor = frag.anchor
    }
    const sharedContentParked = !!sharedContentStorage
    currentParentNode = parentNode
    currentAnchor = anchor

    if (!isMounted) {
      slotNamespace = getContainerType(parentNode as Element)
      scope.run(render)
      isMounted = true
    } else {
      if (sharedContentParked) {
        insert(frag.nodes, parentNode, anchor, suspense)
        sharedContentStorage = undefined
        if (slotResolutionState.activeFallback) {
          slotResolutionState.fallbackInserted = true
        }
      } else if (isVNode(rendered)) {
        // move vdom content
        internals.m(
          rendered,
          parentNode,
          anchor,
          moveType === undefined ? MoveType.REORDER : moveType,
          parentComponent as any,
          suspense,
        )
      } else if (rendered) {
        // move vapor content
        if (moveType === undefined) {
          insert(rendered, parentNode, anchor, suspense)
        } else {
          move(rendered, parentNode, anchor, moveType, undefined, suspense)
        }
      }

      if (!sharedContentParked) {
        insertActiveSlotFallback(slotResolutionState, moveType)
      }
    }

    notifyUpdated()
  }
  frag.insert = (parentNode, anchor, parentSuspense) =>
    place(parentNode, anchor, parentSuspense)
  frag.move = (
    parentNode,
    anchor,
    moveType,
    _parentComponent,
    parentSuspense,
  ) => place(parentNode, anchor, parentSuspense, moveType)

  frag.remove = parentNode => {
    const storage = sharedContentStorage
    if (parentNode && !storage) {
      currentParentNode = parentNode
    }
    scope.stop()
    disposed = true
    // out-in transfers logical ownership before the outgoing branch's
    // physical leave finishes, so disposal must cancel that leave explicitly.
    const leavingElement = pendingOutIn && pendingOutIn.leavingElement
    pendingOutIn = undefined
    const leave =
      leavingElement && (leavingElement as TransitionElement)[leaveCbKey]
    if (leave) leave(true)
    if (rendered) {
      removeRenderedContent(rendered, storage || parentNode)
    }
    disposeSlotResolution(slotResolutionState, storage || parentNode)
    if (storage) {
      const anchor = frag.anchor
      if (anchor && anchor.parentNode === storage) {
        frag.anchor = undefined
      }
      sharedContentStorage = undefined
    }
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    const open = currentHydrationNode
    if (open && isRangeEnd(open)) {
      // An enclosing outlet found all of its content empty and rendered its
      // own range alone: nothing of this one is in the DOM.
      runWithoutHydration(() => place(open.parentNode!, open, undefined))
      return
    }
    if (open && isComment(open, '(')) {
      // the server rendered the local fallback: mount as on the client
      const close = (frag.anchor = claimAnchor(locateEndAnchor(open)!))
      hydrateSlotFallbackRange(
        { first: open.nextSibling!, close, boundary },
        () => place(close.parentNode!, close, undefined),
      )
      // As hydrating content does behind a fallback: a Transition applying its
      // hooks afterwards has to reach through to the fallback.
      if (slotResolutionState.activeFallback) setVNode(null)
      advanceHydrationNode(close)
      return
    }
    // Resolve the namespace from the SSR container before rendering: parked
    // shared content (`parkSharedContent`) points `currentParentNode` at a
    // detached DocumentFragment, which would report HTML for content that
    // belongs under an <svg>/<math>.
    const hydrationParent =
      currentHydrationNode && currentHydrationNode.parentNode
    scope.run(render)
    if (!currentParentNode) {
      currentAnchor = currentSlotEndAnchor || currentHydrationNode
      currentParentNode = currentAnchor!.parentNode as ParentNode
    }
    slotNamespace = getContainerType(
      (hydrationParent || currentParentNode) as Element,
    )
    if (content.valid && localFallback && !inheritFallback && !frag.anchor) {
      // The outlet owns this anchor; as an untracked anchor it is invisible
      // to hydration traversal, so it cannot shift hydration indices.
      const outletAnchor = claimUntrackedAnchor(createTextNode())
      insertUntrackedAnchor(currentParentNode, currentAnchor, outletAnchor)
      frag.anchor = currentAnchor = outletAnchor
    }
    isMounted = true
  }

  return frag

  function cleanupInvalidContent(): void {
    const pending = pendingInOutVNode
    if (pending) {
      pendingInOutVNode = undefined
      const transition = slotResolutionState.$transition
      const fallback = slotResolutionState.activeFallback
      if (transition) {
        prepareTransitionLeave(
          pending,
          fallback && isValidSlot(fallback) ? transition : undefined,
          transition.props,
          transition.state,
          transition.instance,
          NOOP,
        )
      }
      internals.um(
        pending,
        parentComponent as any,
        resolveUnmountSuspense(suspense),
        true,
      )
      return
    }
    if (currentParentNode) {
      removeAttachedNodes(content.nodes, currentParentNode)
    }
  }

  // Parks the exposed content in a detached DocumentFragment while the
  // enclosing shared (aggregate) fallback takes over the live DOM.
  function parkSharedContent(): void {
    if (!currentParentNode || sharedContentStorage) return
    invalidateExposedSlotContent(slotResolutionState)
    const storage = document.createDocumentFragment()
    let anchor = frag.anchor
    if (!anchor || anchor.parentNode !== currentParentNode) {
      anchor = createTextNode()
    }
    storage.appendChild(anchor)
    // VDOM Fragment ranges must keep a common parent while parked so the
    // renderer can patch them before the aggregate fallback switches back.
    insert(frag.nodes, storage, anchor, suspense)
    sharedContentStorage = storage
    currentParentNode = storage
    currentAnchor = anchor
  }

  function notifyUpdated(): void {
    syncInteropRoot(parentComponent)
    if (isMounted && frag.u) {
      frag.u.forEach(hook => hook(frag.nodes))
    }
  }

  function notifyBeforeUpdate(): void {
    if (isMounted && frag.bu) {
      frag.bu.forEach(hook => hook())
    }
  }

  function recheckAfterContentUpdate(forceResolutionRecheck = false): void {
    isContentUpdateRecheck = true
    try {
      recheckSlotResolution(slotResolutionState, forceResolutionRecheck)
    } finally {
      isContentUpdateRecheck = false
    }
  }

  function finishContentUpdate(forceResolutionRecheck = false): void {
    recheckAfterContentUpdate(forceResolutionRecheck)
    notifyUpdated()
  }

  function patchSlotVNode(
    previous: VNode | null,
    next: VNode,
    slotScopeIds: string[] | null,
    valid: boolean,
  ): void {
    setVNode(next)
    const refreshSlotVNode = () => {
      const prevValid = content.valid
      const prevOutput = frag.nodes
      setRendered(next)
      recheckAfterContentUpdate()
      if (
        content.valid !== prevValid ||
        !isSameResolvedOutput(prevOutput, frag.nodes)
      ) {
        notifyUpdated()
      }
    }
    trackSlotVNodeUpdatesWithRefresh(next, refreshSlotVNode, notifyBeforeUpdate)
    internals.p(
      previous,
      next,
      currentParentNode!,
      currentAnchor,
      parentComponent as any,
      suspense,
      slotNamespace,
      concatInteropScopeIds(frag.slotScopeIds, slotScopeIds),
    )
    setRendered(next, valid)
    finishContentUpdate()
  }

  function removeRenderedContent(
    renderedContent: VNode | Block,
    parentNode?: ParentNode,
  ): void {
    const contentDetached = !!slotResolutionState.activeFallback
    // Active fallback means slot content was parked already; runtime-core
    // Fragment removal expects a still-attached sibling range.
    if (isVNode(renderedContent)) {
      internals.um(
        renderedContent,
        parentComponent as any,
        resolveUnmountSuspense(suspense),
        !contentDetached && !!parentNode,
      )
    } else {
      remove(renderedContent, contentDetached ? undefined : parentNode)
    }
  }

  function resumeOutIn(): void {
    // A user leave hook may finish synchronously while the renderer is still
    // patching the placeholder. Resume after that patch.
    queuePostFlushCb(() => {
      const pending = pendingOutIn
      pendingOutIn = undefined
      if (!pending || disposed || !currentParentNode) {
        return
      }

      const pendingContent = pending.content
      if (isVNode(pendingContent)) {
        const nextVNode =
          prepareInteropSlotTransition(
            frag,
            pendingContent,
            forwarded,
            undefined,
            NOOP,
          ) || pendingContent
        patchSlotVNode(
          pending.placeholder,
          nextVNode,
          pendingContent.slotScopeIds,
          pending.contentValid,
        )
      } else {
        setVNode(null)
        if (pending.placeholder) {
          removeRenderedContent(pending.placeholder, currentParentNode)
        }
        if (pendingContent) {
          insert(pendingContent, currentParentNode, currentAnchor, suspense)
        }
        setRendered(pendingContent || null, pending.contentValid)
        finishContentUpdate()
      }
    })
  }

  function render(): void {
    const prev = currentInstance
    simpleSetCurrentInstance(frag.renderInstance)
    try {
      once ? renderContent() : renderEffect(renderContent)
    } finally {
      simpleSetCurrentInstance(prev)
    }
  }

  function renderContent(): void {
    notifyBeforeUpdate()
    withRenderContext(frag.ctx, () =>
      withSlotBoundary(contentBoundary, () => {
        const { content: slotContent, valid: slotContentValid } =
          resolveSlotContent()

        if (isHydrating) {
          hydrateContent(slotContent, slotContentValid)
          return
        }

        if (pendingOutIn) {
          pendingOutIn.content = slotContent
          pendingOutIn.contentValid = slotContentValid
          return
        }

        if (isVNode(slotContent)) {
          applyVNodeContent(slotContent, slotContentValid)
          return
        }

        if (slotContent) {
          applyBlockContent(slotContent, slotContentValid)
          return
        }

        applyEmptyContent()
      }),
    )
  }

  function resolveSlotContent(): {
    content: VNode | Block | undefined
    valid: boolean
  } {
    let slotContent: VNode | Block | undefined
    let slotContentValid = false

    if (slotsRef.value) {
      const renderContent = () =>
        renderSlot(slotsRef.value, isFunction(name) ? name() : name, props)
      slotContent = once ? withOnce(renderContent) : renderContent()

      if (isVNode(slotContent)) {
        slotContentValid =
          slotContent.type !== Fragment || hasValidVNodeContent(slotContent)
      } else if (slotContent) {
        slotContentValid = isValidSlot(slotContent)
      }
    }

    return { content: slotContent, valid: slotContentValid }
  }

  // BaseTransition mode arbitration between slot content, the previous
  // content, and the fallback chain, then the plain patch.
  function applyVNodeContent(
    slotContent: VNode,
    slotContentValid: boolean,
  ): void {
    const prevRendered = rendered
    const transition = slotResolutionState.$transition
    const mode = transition && transition.props.mode
    let delayedLeaveSource: TransitionHooks | undefined
    if (slotResolutionState.activeFallback && !slotContentValid) {
      // Re-run the slot only to refresh validity. While fallback is
      // active, a still-invalid VNode must stay out of the live DOM.
      applyEmptyContent()
      return
    }
    if (slotResolutionState.activeFallback && slotContentValid && transition) {
      if (mode === 'out-in') {
        const fallback = slotResolutionState.activeFallback
        const leavingBlock = fallback && findTransitionBlock(fallback)
        const leavingElement =
          leavingBlock && getTransitionElement(leavingBlock)
        pendingOutIn = {
          content: slotContent,
          placeholder: null,
          contentValid: true,
          leavingElement,
        }
        if (leaveSlotFallback(slotResolutionState, transition, resumeOutIn)) {
          return
        }
        pendingOutIn = undefined
      } else if (mode === 'in-out') {
        // Keep the fallback's current enter hooks separate from the
        // delayed leave that will be forwarded to the incoming VNode.
        const enterHooks = extend({}, transition)
        delete enterHooks.delayedLeave
        leaveSlotFallback(slotResolutionState, enterHooks, NOOP)
        delayedLeaveSource = enterHooks
      }
    }
    const prevIsVNode = isVNode(prevRendered)
    const prevVNode =
      prevIsVNode && (!slotResolutionState.activeFallback || content.valid)
        ? prevRendered
        : null
    if (
      prevVNode &&
      !slotContentValid &&
      transition &&
      hasSlotFallback(boundary)
    ) {
      if (mode === 'out-in') {
        const placeholder =
          prepareInteropSlotTransition(
            frag,
            slotContent,
            forwarded,
            undefined,
            NOOP,
          ) || createCommentVNode()
        if (
          prepareTransitionLeave(
            prevVNode,
            undefined,
            transition.props,
            transition.state,
            transition.instance,
            resumeOutIn,
          )
        ) {
          suspendForOutIn(prevVNode, placeholder, slotContent, false)
          return
        }
      } else if (mode === 'in-out') {
        pendingInOutVNode = prevVNode
        setVNode(null)
        setRendered(null)
        finishContentUpdate()
        return
      }
    }
    const transitionChild = prepareInteropSlotTransition(
      frag,
      slotContent,
      forwarded,
      prevVNode || undefined,
      resumeOutIn,
      delayedLeaveSource,
    )
    const nextVNode = transitionChild || slotContent
    if (
      prevVNode &&
      transitionChild &&
      transition &&
      transition.state.isLeaving
    ) {
      suspendForOutIn(prevVNode, nextVNode, slotContent, slotContentValid)
      return
    }
    if (prevRendered && !prevIsVNode) {
      removeRenderedContent(prevRendered, currentParentNode!)
    }
    // Preserve the original slot wrapper's scope IDs for :slotted
    // styles.
    patchSlotVNode(
      prevVNode,
      nextVNode,
      slotContent.slotScopeIds,
      slotContentValid,
    )
  }

  function applyBlockContent(
    slotContent: Block,
    slotContentValid: boolean,
  ): void {
    setVNode(null)
    const prevRendered = rendered
    if (prevRendered) {
      removeRenderedContent(prevRendered, currentParentNode!)
    }
    insert(slotContent, currentParentNode!, currentAnchor, suspense)
    setRendered(slotContent, slotContentValid)
    finishContentUpdate()
  }

  function applyEmptyContent(): void {
    if (rendered) {
      removeRenderedContent(rendered, currentParentNode!)
    }
    setVNode(null)
    setRendered(null)
    finishContentUpdate()
  }

  // `vnode` and `$key` move together: the key identifies the exposed vnode.
  function setVNode(vnode: VNode | null): void {
    frag.vnode = vnode
    frag.$key = vnode ? getVNodeKey(vnode) : undefined
  }

  /** Commit rendered output, deriving the content nodes and validity. */
  function setRendered(
    renderedContent: VNode | Block | null,
    knownValid?: boolean,
  ): void {
    rendered = renderedContent
    if (isVNode(renderedContent)) {
      content.nodes = resolveVNodeNodes(renderedContent)
      content.valid =
        knownValid === undefined
          ? hasValidVNodeContent(renderedContent)
          : knownValid
    } else if (renderedContent) {
      content.nodes = renderedContent
      content.valid =
        knownValid === undefined ? isValidSlot(renderedContent) : knownValid
    } else {
      content.nodes = EMPTY_BLOCK
      content.valid = false
    }
    content.resolved = true
  }

  // Park the incoming content while the outgoing VNode's leave finishes: the
  // renderer patches to the placeholder, and resumeOutIn completes the
  // switch.
  function suspendForOutIn(
    prevVNode: VNode,
    placeholder: VNode,
    slotContent: VNode | Block,
    contentValid: boolean,
  ): void {
    const leavingElement = getInteropTransitionElement(prevVNode)
    pendingOutIn = {
      content: slotContent,
      placeholder,
      contentValid,
      leavingElement,
    }
    setVNode(placeholder)
    // The renderer owns the placeholder while the outgoing VNode remains in
    // the DOM until its leave finishes.
    rendered = placeholder
    internals.p(
      prevVNode,
      placeholder,
      currentParentNode!,
      currentAnchor,
      parentComponent as any,
      suspense,
      slotNamespace,
      null,
    )
  }

  /**
   * One-shot hydration claimer: adopts the SSR-rendered slot content instead
   * of mounting. Runs only on the first render pass under an active hydration
   * cursor; later passes take the CSR paths above.
   */
  function hydrateContent(
    slotContent: VNode | Block | undefined,
    slotContentValid: boolean,
  ): void {
    // Self-containment guard, and the DCE gate: everything below is
    // hydration-only, so with no SSR entry bundled `isHydrating` folds to
    // false and this body drops out of CSR bundles.
    if (!isHydrating) return
    // An empty VDOM slot fragment is still the hydration owner of the
    // SSR fragment markers when no fallback takes over. Keep hydrating
    // that content so later updates can patch inside the existing
    // range instead of mounting before it.
    const hydratedContent =
      slotContent && (slotContentValid || !hasSlotFallback(boundary))
        ? slotContent
        : undefined
    if (isVNode(hydratedContent)) {
      const transitionChild = prepareInteropSlotTransition(
        frag,
        hydratedContent,
        forwarded,
        undefined,
        NOOP,
      )
      const hydrationVNode = transitionChild || hydratedContent
      setVNode(hydrationVNode)
      const refreshSlotVNode = () => {
        frag.nodes = resolveVNodeNodes(hydrationVNode)
        notifyUpdated()
      }
      trackSlotVNodeUpdatesWithRefresh(
        hydrationVNode,
        refreshSlotVNode,
        notifyBeforeUpdate,
      )
      const hydrationParent = parentNode(currentHydrationNode!)!
      // A transition child is taken out of the slot's fragment, whose range
      // the server still rendered: the child hydrates inside it.
      const close = transitionChild && locateFragmentEnd(currentHydrationNode)
      if (close) setCurrentHydrationNode(currentHydrationNode!.nextSibling)
      hydrateVNode(
        hydrationVNode,
        parentComponent as any,
        concatInteropScopeIds(
          frag.slotScopeIds,
          hydrationVNode === hydratedContent
            ? null
            : hydratedContent.slotScopeIds,
        ),
      )
      if (close) {
        frag.anchor = claimAnchor(close)
        advanceHydrationNode(close)
      }
      // Remember the slot outlet insertion point outside the hydrated VNode range.
      // The hydrated content itself may be removed by later VDOM patches before the
      // fallback is inserted.
      currentParentNode = hydrationParent
      currentAnchor = internals.n(hydrationVNode) as Node | null
      setRendered(hydrationVNode, slotContentValid)
    } else if (hydratedContent) {
      setVNode(null)
      setRendered(hydratedContent as Block, slotContentValid)
    } else {
      setVNode(null)
      setRendered(null)
    }
    finishContentUpdate(true)
  }
}

// VDOM fragment unmount can ask Vapor to dispose a block with doRemove=false,
// leaving no container from the renderer. Most blocks clean up without it, but
// nested KeepAlive branches need the current host parent to remove their live
// block and let deeper cleanup such as Teleport teardown run.
function needsHostParentForRemove(block: Block): boolean {
  if (isVaporComponent(block)) {
    return isKeepAlive(block) || needsHostParentForRemove(block.block)
  }
  if (isArray(block)) {
    return block.some(needsHostParentForRemove)
  }
  if (isFragment(block)) {
    return needsHostParentForRemove(block.nodes)
  }
  return false
}

export const vaporInteropPlugin: Plugin = app => {
  if (__FEATURE_SUSPENSE__) {
    enableSuspense()
  }
  setInteropEnabled()
  setPublishInteropScopeIds(publishVaporScopeIds)
  app._context.vapor = vaporInteropImpl
  const internals = ensureRenderer().internals
  app._context.vdom = {
    mount: createVDOMComponent.bind(null, internals),
    slot: renderVDOMSlot.bind(null, internals),
    mountVNode: mountDynamicVNode.bind(null, internals),
  } satisfies VdomInVaporInterface
  const mount = app.mount
  app.mount = ((...args) => {
    optimizePropertyLookup()
    return mount(...args)
  }) satisfies App['mount']
}

function hydrateVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  slotScopeIds: string[] | null = null,
) {
  const node = currentHydrationNode!
  if (!vdomHydrateNode) vdomHydrateNode = ensureHydrationRenderer().hydrateNode!
  const nextNode = vdomHydrateNode(
    node,
    vnode,
    parentComponent,
    null,
    slotScopeIds,
    false,
  )
  // no next node: the vnode ends its parent, move on from there
  if (nextNode) setCurrentHydrationNode(nextNode)
  else advanceHydrationNode(parentNode(node)!)
}

// The fallback block of the outlet at `depth` on the slot's chain (0 is the
// outlet that rendered the slot, then each enclosing one); its boundary hands
// it out only while that outlet is on the chain.
function createFallback(
  state: InteropVaporSlotState,
  depth: number,
  parentComponent: ComponentInternalInstance | null,
): BlockFn {
  const internals = ensureRenderer().internals
  return () => {
    const frag = createVNodeChildrenFragment(
      internals,
      () => {
        // through the ref: an owner re-render swaps the fallback body, and
        // the effect patches it in place
        const outlet = state.outletsRef.value[depth]
        const children =
          outlet && invokeSlotFallback(outlet.fallback, outlet.owner)
        return children == null
          ? EMPTY_VNODES
          : normalizeInteropSlotValue(children)
      },
      parentComponent,
    )
    if (isHydrating && frag.hydrate) {
      frag.hydrate()
    }
    return frag
  }
}

// Mounts a slot the server rendered nothing of, as on the client and ahead of
// `close`: the end of the range the slot owns from `open` on, or a marker of
// something else. A fallback the server rendered in its place
// (`fallbackRange`) is adopted where it is.
function mountSlotWithoutHydration(
  vnode: VNode,
  open: Node | null,
  close: Node,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  slotScopeIds: string[] | null,
  fallbackRange?: OutletFallbackRange,
): void {
  const container = parentNode(close)!
  const mount = () => {
    const block = (vnode.vb = renderVaporSlot(
      vnode,
      parentComponent,
      parentSuspense,
      slotScopeIds,
      fallbackRange,
    ))
    let anchor = close
    if (!open) {
      // a self anchor as on mount
      anchor = (isFragment(block) && block.anchor) || createTextNode()
      insert(anchor, container, close)
    }
    vnode.el = open || anchor
    vnode.anchor = anchor
    insert(block, container, anchor, parentSuspense)
  }
  if (fallbackRange) hydrateSlotFallbackRange(fallbackRange, mount)
  else runWithoutHydration(mount)
}

// The server rendered the fallback of this outlet in place of its content, the
// slot and what is around it. Only the slot has anything to adopt, that
// fallback, where it is: the slot, the fragments down to it and what is beside
// it mount around it, as on the client. All of them are vnodes, or no outlet
// would have been attached.
function hydrateOutletFallback(
  children: VNode[],
  node: Node,
  close: Node,
  // outlets between this one and the slot: its index among the slot's
  depth: number,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  slotScopeIds: string[] | null,
): Node {
  const container = parentNode(node)!
  const internals = ensureRenderer().internals
  // the fallback is ahead until the slot has adopted it, behind after
  let next: Node = node
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.vs) {
      const outlets = child.vs.outlets
      mountSlotWithoutHydration(
        child,
        null,
        close,
        parentComponent,
        parentSuspense,
        slotScopeIds,
        {
          // the slot's own outlet comes first among them, and is no fragment
          depth: outlets && outlets[0].innerIds == null ? depth + 1 : depth,
          first: node,
          close,
        },
      )
      next = close
    } else if (child.type === Fragment && hasVaporSlot(child)) {
      insert((child.el = createTextNode()), container, next)
      next = hydrateOutletFallback(
        child.children as VNode[],
        node,
        close,
        child.vo ? depth + 1 : depth,
        parentComponent,
        parentSuspense,
        child.slotScopeIds
          ? concatInteropScopeIds(slotScopeIds, child.slotScopeIds)
          : slotScopeIds,
      )
      insert((child.anchor = createTextNode()), container, next)
    } else {
      runWithoutHydration(() =>
        internals.p(
          null,
          child,
          container as any,
          next as any,
          parentComponent,
          parentSuspense,
          getContainerType(container as Element),
          slotScopeIds,
        ),
      )
    }
  }
  return next
}

function hasVaporSlot(fragment: VNode): boolean {
  return (fragment.children as VNode[]).some(
    child => child.vs || (child.type === Fragment && hasVaporSlot(child)),
  )
}

// Hands the fallback of a vdom outlet over to the vapor slot its content
// consists of, if it is that one slot: the slot resolves it once it renders
// empty. Lives here rather than beside `renderSlot` so that vdom-only bundles
// carry none of it.
function attachSlotOutlet(
  content: VNodeArrayChildren,
  fallback: () => VNodeArrayChildren,
  owner: ComponentInternalInstance | null,
): boolean {
  let slot = findLoneSlot(content, 0) ? loneSlot : null
  if (slot) {
    // a vnode its owner keeps (`<slot v-once/>`) is every placement's: the
    // record goes on a clone taking its place
    if (slot.cacheIndex != null) {
      slot = loneSlotIn![loneSlotAt] = cloneVNode(slot)
    }
    // never written in place: clones share the records
    const vs = slot.vs!
    const outlet = { fallback, owner, innerIds: loneSlotInnerIds }
    vs.outlets = vs.outlets ? vs.outlets.concat(outlet) : [outlet]
  }
  loneSlot = loneSlotIn = null
  return !!slot
}

// scratch of the walk below, which runs no user code and cannot re-enter
let loneSlot: VNode | null = null
let loneSlotIn: VNodeArrayChildren | null = null
let loneSlotAt = 0
let loneSlotInnerIds = 0

// Looks for the vapor slot in outlet content through fragments (an outlet
// inside renders one) and past comments, the way `ensureValidVNode` does, and
// leaves it in the scratch above. False once the content cannot be that one
// slot: valid vdom content, a second slot, or a list.
function findLoneSlot(vnodes: VNodeArrayChildren, pathIds: number): boolean {
  for (let i = 0; i < vnodes.length; i++) {
    const child = vnodes[i]
    if (!isVNode(child)) return false
    if (child.vs) {
      if (loneSlot) return false
      loneSlot = child
      loneSlotIn = vnodes
      loneSlotAt = i
      loneSlotInnerIds = pathIds
    } else if (child.type === Fragment) {
      if (
        (child.patchFlag > 0 &&
          child.patchFlag &
            (PatchFlags.KEYED_FRAGMENT | PatchFlags.UNKEYED_FRAGMENT)) ||
        !findLoneSlot(
          child.children as VNodeArrayChildren,
          // what the renderer appends to the patch context on the way in
          pathIds + (child.slotScopeIds ? child.slotScopeIds.length : 0),
        )
      ) {
        return false
      }
    } else if (child.type !== VNodeComment) {
      return false
    }
  }
  return true
}

interface InteropVaporSlotState {
  // vdom outlets whose fallback this slot resolves, innermost first. Chain
  // walks read the plain list; only fallback bodies track the ref, so a walk
  // inside some effect does not subscribe it to every patch of the slot.
  outlets: readonly VdomSlotOutlet[]
  outletsRef: ShallowRef<readonly VdomSlotOutlet[]>
}

function resolveInteropVaporSlotState(vnode: VNode): InteropVaporSlotState {
  const slot = vnode.vs!
  let state = slot.state as InteropVaporSlotState | undefined
  if (!state) {
    const outlets = slot.outlets || EMPTY_ARR
    state = { outlets, outletsRef: shallowRef(outlets) }
    slot.state = state
  }
  return state
}

function syncInteropVaporSlotState(n1: VNode, n2: VNode): void {
  const prevState = n1.vs!.state as InteropVaporSlotState | undefined
  if (!prevState) {
    return
  }
  n2.vs!.state = prevState
  prevState.outletsRef.value = prevState.outlets = n2.vs!.outlets || EMPTY_ARR
}

function trackInteropFallbackChanges(
  scope: ReturnType<typeof effectScope> | undefined,
  state: InteropVaporSlotState,
  onChange: () => void,
): void {
  if (!scope) return
  let trackedDepth = state.outlets.length
  scope.run(() => {
    renderEffect(() => {
      // Only an outlet joining or leaving the chain re-resolves it: a
      // fallback body swapped for another (compiled fallbacks are fresh
      // closures per owner render) patches in place through its own
      // fragment effect.
      const nextDepth = state.outletsRef.value.length
      if (nextDepth !== trackedDepth) {
        trackedDepth = nextDepth
        onChange()
      }
    }, true)
  })
}

interface OutletFallbackRange extends SlotFallbackRange {
  // which of the slot's outlets
  depth: number
}

function renderVaporSlot(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  // the raw slot patch context; kept off the vnode so cached/cloned VaporSlot
  // vnodes never accumulate it
  contextSlotScopeIds: string[] | null,
  fallbackRange?: OutletFallbackRange,
): Block {
  const prev = currentInstance
  const prevCtx = currentRenderContext
  simpleSetCurrentInstance(parentComponent)
  if (__FEATURE_SUSPENSE__ && isSuspenseEnabled && parentSuspense) {
    setRenderContext(deriveSuspense(prevCtx, parentSuspense))
  }
  try {
    if (!vnode.vs || !vnode.vs.slot) {
      return EMPTY_BLOCK
    }
    const slotState = resolveInteropVaporSlotState(vnode)
    // Most of the interop setup is shared, but slots that start with a local
    // VDOM fallback still need to let an inner SlotFragment own the active
    // fallback lifecycle. Forcing the interop wrapper to own that branch breaks
    // fallback blocks that can later resolve to an empty vnode list.
    const frag = createInteropFragment(EMPTY_BLOCK, null, SLOT_OUTLET)
    // The vnode-derived slot context becomes the creation ambient for the
    // vapor-rendered content, restored via the fragment's render seam.
    const inherited = getInheritedScopeIds(vnode, parentComponent, false)
    frag.ctx = deriveSlotScopeIds(
      frag.ctx,
      getInteropVaporSlotScopeIds(
        contextSlotScopeIds,
        vnode.slotScopeIds,
        inherited,
      ),
    )
    const content = new InteropContentState()
    frag.isBlockValid = componentAsValid =>
      content.resolved ? isValidBlock(frag.nodes, componentAsValid) : true
    const slotBoundary = frag.slotBoundary
    let isResolvingContent = false
    let currentParentNode: ParentNode | null = null
    let currentAnchor: Node | null = null
    let disposed = false
    let slotResolutionState!: SlotResolutionState
    let ownedSlotFragment: SlotFragment | undefined
    let ownedSlotFragmentDirtyQueued = false
    let ownedSlotFragmentDirtyForce = false
    const onContentInvalid = [
      () => {
        if (currentParentNode) {
          removeAttachedNodes(content.nodes, currentParentNode)
        }
      },
    ]
    const markInteropSlotResolutionDirty = (force?: boolean): void => {
      const target = ownedSlotFragment
      if (!target) {
        markSlotResolutionDirty(slotResolutionState, force)
        return
      }
      ownedSlotFragmentDirtyForce = ownedSlotFragmentDirtyForce || !!force
      // When the inner SlotFragment owns the fallback, a single vdom flush
      // can dirty this slot multiple times; batch into one post-flush recheck
      // so it observes the settled re-rendered content.
      if (ownedSlotFragmentDirtyQueued) {
        return
      }
      ownedSlotFragmentDirtyQueued = true
      queuePostFlushCb(() => {
        ownedSlotFragmentDirtyQueued = false
        const force = ownedSlotFragmentDirtyForce
        ownedSlotFragmentDirtyForce = false
        markSlotResolutionDirty(target, force)
      })
    }
    // One boundary per vdom outlet on the chain, innermost first, built as
    // the chain is walked. The chain follows the outlets recorded on the
    // latest vnode and continues into the ambient boundary past the last.
    const outletBoundaries: SlotBoundaryContext[] = []
    const createOutletBoundary = (
      depth: number,
      onContentInvalid?: (() => void)[],
    ): SlotBoundaryContext => {
      let fallback: BlockFn | undefined
      return createSlotBoundary(
        frag,
        () => getOutletBoundary(depth + 1),
        () =>
          slotState.outlets[depth]
            ? (fallback ||= createFallback(slotState, depth, parentComponent))
            : undefined,
        markInteropSlotResolutionDirty,
        onContentInvalid,
        () => {
          const outlet = slotState.outlets[depth]
          // the vnode's own outlet renders under the vnode's own cell
          return outlet && outlet.innerIds != null
            ? getEnclosingOutletScopeIds(
                contextSlotScopeIds,
                outlet.innerIds,
                inherited,
              )
            : frag.slotScopeIds
        },
      )
    }
    const getOutletBoundary = (depth: number): SlotBoundaryContext | null =>
      depth < slotState.outlets.length
        ? (outletBoundaries[depth] ||= createOutletBoundary(depth))
        : slotBoundary
    // the slot's own resolution point stays with no outlet on the chain: it
    // is where the content parks while a fallback shows
    const rootBoundary = (outletBoundaries[0] = createOutletBoundary(
      0,
      onContentInvalid,
    ))
    slotResolutionState = createSlotResolutionState(rootBoundary, {
      getContent: () => content.nodes,
      getParentNode: () => currentParentNode,
      getAnchor: () => currentAnchor,
      isBusy: () => isResolvingContent,
      isDisposed: () => disposed,
      isContentValid: () => isValidSlot(content.nodes),
      syncNodes: () => {
        frag.nodes = resolveExposedSlotNodes(slotResolutionState)
        content.resolved = true
      },
      notifyExposedValidityChange: () => {
        if (slotBoundary) {
          slotBoundary.markDirty()
        }
      },
    })
    const takePendingRecheck = (): boolean => {
      const force = slotResolutionState.pendingRecheckForce
      slotResolutionState.pendingRecheck = false
      slotResolutionState.pendingRecheckForce = false
      return force
    }

    const dispose = (parentNode?: ParentNode): void => {
      if (disposed) return
      if (parentNode) {
        currentParentNode = parentNode
      }
      disposed = true
      disposeSlotResolution(slotResolutionState, parentNode)
      currentParentNode = null
      currentAnchor = null
    }

    try {
      const hasInteropFallback = slotState.outlets.length > 0
      slotResolutionState.pendingRecheck = false
      slotResolutionState.pendingRecheckForce = false
      const finalizeResolvedContent = (
        resolvedContent: Block | undefined,
      ): Block | undefined => {
        // SLOT_RESOLVER, not the SLOT bit: fast-path outlet fragments
        // carry SLOT but run no slot resolution to delegate to.
        if (hasInteropFallback && isSlotResolver(resolvedContent)) {
          return resolvedContent
        }
        content.nodes = resolvedContent || EMPTY_BLOCK
        recheckSlotResolution(slotResolutionState, takePendingRecheck())
        return resolvedContent
      }
      let resolvedContent: Block | undefined
      const renderContent = () =>
        (resolvedContent = finalizeResolvedContent(
          withRenderContext(frag.ctx, () =>
            withSlotBoundary(rootBoundary, () => invokeVaporSlot(vnode)),
          ),
        ))
      isResolvingContent = true
      try {
        if (fallbackRange) {
          ;(fallbackRange.boundary = getOutletBoundary(
            fallbackRange.depth,
          )!).adoptFallback = fallbackRange.adopt
        }
        if (isHydrating) {
          withHydratingSlotBoundary(renderContent)
        } else {
          renderContent()
        }
      } finally {
        isResolvingContent = false
      }
      if (hasInteropFallback && isSlotResolver(resolvedContent)) {
        ownedSlotFragment = resolvedContent
        trackInteropFallbackChanges(vnode.vs!.scope, slotState, () =>
          markInteropSlotResolutionDirty(),
        )
        dispose()
        return resolvedContent
      }

      slotResolutionState.pendingRecheck = false
      slotResolutionState.pendingRecheckForce = false
      frag.insert = (parentNode, anchor, parentSuspense) => {
        currentParentNode = parentNode
        currentAnchor = anchor
        if (slotResolutionState.activeFallback) {
          insertActiveSlotFallback(slotResolutionState)
        } else {
          insert(frag.nodes, parentNode, anchor, parentSuspense)
        }
      }
      frag.move = (
        parentNode,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      ) => {
        currentParentNode = parentNode
        currentAnchor = anchor
        if (slotResolutionState.activeFallback) {
          insertActiveSlotFallback(slotResolutionState, moveType)
        } else {
          move(
            frag.nodes,
            parentNode,
            anchor,
            moveType,
            parentComponent,
            parentSuspense,
          )
        }
      }
      frag.remove = parentNode => {
        if (!slotResolutionState.activeFallback) {
          remove(frag.nodes, parentNode)
        }
        dispose(parentNode)
      }
      trackInteropFallbackChanges(vnode.vs!.scope, slotState, () => {
        recheckSlotResolution(slotResolutionState, true)
      })

      if (isHydrating && currentHydrationNode) {
        currentAnchor = currentHydrationNode
        currentParentNode = currentAnchor.parentNode as ParentNode | null
      }

      return frag
    } catch (e) {
      dispose(currentParentNode || undefined)
      stopVaporSlotScope(vnode)
      throw e
    }
  } finally {
    setRenderContext(prevCtx)
    simpleSetCurrentInstance(prev)
  }
}

function stopVaporSlotScope(vnode: VNode): void {
  if (vnode.vs && vnode.vs.scope) {
    vnode.vs.scope.stop()
    vnode.vs.scope = undefined
  }
}

/**
 * Slot functions can create renderEffects while evaluating their block.
 * Those effects live in this dedicated scope so slot re-mount/unmount can
 * dispose them immediately instead of waiting for the parent component.
 */
function invokeVaporSlot(vnode: VNode): Block {
  const propsRef = (vnode.vs!.ref = shallowRef(vnode.props))
  const scope = effectScope()
  vnode.vs!.scope = scope
  try {
    const run = () =>
      vnode.vs!.slot(new Proxy(propsRef, vaporSlotPropsProxyHandler))
    // vdom is a boundary: the slot it invokes runs live even when the vdom
    // render sits inside a v-once extent.
    return (inOnce ? withOnce(() => scope.run(run), false) : scope.run(run))!
  } catch (e) {
    vnode.vs!.scope = undefined
    scope.stop()
    throw e
  }
}

// The tracking callback keeps el-sync registered on any dynamic fragments
// along the effective-root chain, including ones a root switch introduced.
function resolveInteropRootEl(
  instance: VaporComponentInstance,
): Element | undefined {
  return getRootElement(instance, {
    onDynamicFragment: frag => registerInteropRootSync(instance, frag),
  })
}

function syncVNodeEl(vnode: VNode, instance: VaporComponentInstance): void {
  vnode.el = resolveInteropRootEl(instance) || vnode.anchor
}

function syncInteropRoot(instance: VaporComponentInstance): void {
  const state = vnodeHookStateMap.get(instance)
  if (!state) return
  syncVNodeEl(state.vnode, instance)
}

// VDOM inherits a component vnode's directives onto the rendered root vnode:
// every component on the root chain re-renders with the bindings it last
// received, and the one rendering the root element mounts, patches and
// unmounts them with it. A vapor child renders past the renderer, so interop
// keeps that record per root-chain component (the instance included).
interface InteropDirsOwner {
  comp: VaporComponentInstance
  // bindings last received down the chain (vdom: `instance.vnode`)
  vnode: VNode
  // the root element this component renders, and the bindings it carries: a
  // renderer-driven update only lands there with its `updated`, so a root
  // replaced mid-update still unmounts with the bindings it was mounted with
  el: Element | null
  carried: VNode
  // the re-render that owes this root its `updated`, and the root this
  // component's own re-render is patching
  updating: VaporComponentInstance | null
  patching: InteropDirsOwner | null
  // the bindings a reactivated root still carries; its activation patch has
  // not run `updated` yet
  pending: VNode | null
}

function invokeInteropDirsHook(
  instance: VaporComponentInstance,
  el: Element,
  vnode: VNode,
  name: Parameters<typeof invokeDirectiveHook>[3],
  prevVNode: VNode | null = null,
): void {
  if (!vnode.dirs) return
  invokeDirectiveHook(
    // hooks are handed `vnode.el`, which moves on with the root
    vnode.el === el ? vnode : extend({}, vnode, { el }),
    prevVNode,
    instance.parent as ComponentInternalInstance | null,
    name,
  )
}

function queueInteropDirsJob(
  instance: VaporComponentInstance,
  job: () => void,
  suspense: SuspenseBoundary | null = instance.suspense,
): void {
  queuePostRenderEffect(job, undefined, suspense)
}

function warnNonElementRootDirs(): void {
  warn(
    `Runtime directive used on component with non-element root node. ` +
      `The directives will not function as intended.`,
  )
}

// The record of `comp`, handed `vnode` as the bindings it receives.
function getInteropDirsOwner(
  state: VNodeHookState,
  comp: VaporComponentInstance,
  vnode: VNode,
): InteropDirsOwner {
  const owners = (state.dirsOwners ||= new Map())
  let owner = owners.get(comp)
  if (owner) {
    owner.vnode = vnode
  } else {
    owners.set(
      comp,
      (owner = {
        comp,
        vnode,
        el: null,
        carried: vnode,
        updating: null,
        patching: null,
        pending: null,
      }),
    )
  }
  return owner
}

// Walks the root chain from `block`, handing `inherit`'s bindings down to the
// components on it (vdom: the parent patch every chain component re-renders
// from) and returns the innermost one with the element it renders.
function resolveInteropDirsRoot(
  instance: VaporComponentInstance,
  state: VNodeHookState,
  block: Block,
  inherit: InteropDirsOwner,
): [InteropDirsOwner, Element | undefined] {
  let owner = inherit
  const el = getRootElement(block, {
    // a slot outlet is a fragment root in vdom: nothing for directives to
    // land on
    excludeSlotOutlets: true,
    onDynamicFragment: frag =>
      registerInteropDirsFragment(instance, state, frag, owner),
    onComponent: comp => {
      registerInteropDirsComponent(instance, state, comp)
      owner = getInteropDirsOwner(state, comp, inherit.vnode)
    },
  })
  return [owner, el]
}

// The innermost root-chain component below `comp`, visiting every one on the
// way down.
function innerInteropDirsOwner(
  state: VNodeHookState,
  comp: VaporComponentInstance,
  visit?: (owner: InteropDirsOwner) => void,
): InteropDirsOwner | undefined {
  const owners = state.dirsOwners
  let owner: InteropDirsOwner | undefined
  if (!owners) return
  getRootElement(comp, {
    excludeSlotOutlets: true,
    onComponent: comp => {
      const next = owners.get(comp)
      if (next) {
        owner = next
        if (visit) visit(next)
      }
    },
  })
  return owner
}

// A renderer-driven update hands its bindings down the active chain before
// the render; a component that render deactivates never received them (vdom
// does not patch it), so it gets its last bindings back once the chain has
// settled.
function settleInteropDirsReceived(
  instance: VaporComponentInstance,
  state: VNodeHookState,
): void {
  const received = state.dirsReceived
  if (!received) return
  state.dirsReceived = null
  const active = new Set<InteropDirsOwner>()
  innerInteropDirsOwner(state, instance, owner => active.add(owner))
  received.forEach(([owner, vnode]) => {
    if (!active.has(owner)) owner.vnode = vnode
  })
}

// vdom mount of the inherited root vnode
function mountInteropDirsRoot(
  instance: VaporComponentInstance,
  owner: InteropDirsOwner,
  el: Element,
): void {
  const vnode = (owner.carried = owner.vnode)
  owner.el = el
  invokeInteropDirsHook(instance, el, vnode, 'created')
  invokeInteropDirsHook(instance, el, vnode, 'beforeMount')
  queueInteropDirsJob(instance, () =>
    invokeInteropDirsHook(instance, el, vnode, 'mounted'),
  )
}

// vdom unmount of the inherited root vnode; `comp` goes with its root, after
// its own `bum`, and `unmounted` follows the boundary of the unmount pass
function unmountInteropDirs(
  instance: VaporComponentInstance,
  state: VNodeHookState,
  comp: VaporComponentInstance,
): void {
  const owners = state.dirsOwners
  const owner = owners && owners.get(comp)
  if (!owner) return
  owners.delete(comp)
  if (owner.el) {
    unmountInteropDirsRoot(
      instance,
      owner,
      resolveUnmountSuspense(instance.suspense),
    )
  }
}

function unmountInteropDirsRoot(
  instance: VaporComponentInstance,
  owner: InteropDirsOwner,
  suspense?: SuspenseBoundary | null,
): void {
  const el = owner.el!
  const vnode = owner.carried
  owner.el = null
  owner.updating = owner.pending = null
  invokeInteropDirsHook(instance, el, vnode, 'beforeUnmount')
  queueInteropDirsJob(
    instance,
    () => invokeInteropDirsHook(instance, el, vnode, 'unmounted'),
    suspense,
  )
}

// renderer-driven update of the inherited root vnode
function updateInteropDirs(
  instance: VaporComponentInstance,
  state: VNodeHookState,
  vnode: VNode,
  prevVNode: VNode,
): void {
  if (!state.dirsOwners) return
  settleInteropDirsReceived(instance, state)
  const owner = innerInteropDirsOwner(state, instance, owner => {
    // only a component below the instance can leave its root chain
    if (owner.comp !== instance) {
      ;(state.dirsReceived ||= []).push([owner, owner.vnode])
    }
    owner.vnode = vnode
  })
  const el = owner && owner.el
  if (el) invokeInteropDirsHook(instance, el, vnode, 'beforeUpdate', prevVNode)
  queueInteropDirsJob(instance, () => {
    settleInteropDirsReceived(instance, state)
    // a root the update replaced was mounted, not patched; one it
    // deactivated was not patched either
    if (
      !el ||
      owner!.el !== el ||
      innerInteropDirsOwner(state, instance) !== owner
    ) {
      return
    }
    owner!.carried = vnode
    invokeInteropDirsHook(instance, el, vnode, 'updated', prevVNode)
  })
}

// Whether the re-render that marked `owner` still renders its root: a mark
// left by a component that switched the root out since is stale.
function isInteropDirsUpdating(
  state: VNodeHookState,
  owner: InteropDirsOwner,
): boolean {
  return (
    !!owner.updating && innerInteropDirsOwner(state, owner.updating) === owner
  )
}

// `source` re-renders: vdom patches the inherited root vnode below it again,
// and that root's `updated` is owed to this re-render.
function beforeInteropDirsSelfUpdate(
  instance: VaporComponentInstance,
  state: VNodeHookState,
  source: VaporComponentInstance,
): void {
  const owners = state.dirsOwners
  const self = owners && owners.get(source)
  if (!self) return
  // the renderer-driven update in flight already patched the active chain
  if (
    state.pendingVNodeUpdate &&
    (source === instance || isOnInteropRootChain(instance, source))
  ) {
    return
  }
  const owner = self.el ? self : innerInteropDirsOwner(state, source)
  if (!owner || !owner.el || isInteropDirsUpdating(state, owner)) return
  owner.updating = source
  self.patching = owner
  invokeInteropDirsHook(
    instance,
    owner.el,
    owner.vnode,
    'beforeUpdate',
    owner.pending || owner.carried,
  )
}

function afterInteropDirsSelfUpdate(
  instance: VaporComponentInstance,
  state: VNodeHookState,
  source: VaporComponentInstance,
): void {
  const owners = state.dirsOwners
  const self = owners && owners.get(source)
  const owner = self && self.patching
  if (!owner) return
  self.patching = null
  // another re-render took the root over, or replaced or deactivated it
  if (owner.updating !== source) return
  owner.updating = null
  if (owner.el && innerInteropDirsOwner(state, source) === owner) {
    const prevVNode = owner.pending || owner.carried
    owner.pending = null
    owner.carried = owner.vnode
    invokeInteropDirsHook(instance, owner.el, owner.vnode, 'updated', prevVNode)
  }
}

function invokeInteropVNodeHook(
  instance: VaporComponentInstance,
  hook: VNodeHook | null | undefined,
  vnode: VNode,
  prevVNode: VNode | null = null,
): void {
  if (hook) invokeVNodeHook(hook, instance.parent, vnode, prevVNode)
}

function queueInteropVNodeHook(
  instance: VaporComponentInstance,
  hook: VNodeHook | null | undefined,
  vnode: VNode,
  suspense: SuspenseBoundary | null,
): void {
  if (hook) {
    queuePostRenderEffect(
      () => invokeVNodeHook(hook, instance.parent, vnode),
      undefined,
      suspense,
    )
  }
}

function invokeInteropVNodeBeforeUpdate(
  instance: VaporComponentInstance,
  vnode: VNode,
  prevVNode: VNode,
): void {
  invokeInteropVNodeHook(
    instance,
    vnode.props && vnode.props.onVnodeBeforeUpdate,
    vnode,
    prevVNode,
  )
  if (vnode.ibu) vnode.ibu()
}

function invokeInteropVNodeUpdated(
  instance: VaporComponentInstance,
  vnode: VNode,
  prevVNode: VNode,
): void {
  invokeInteropVNodeHook(
    instance,
    vnode.props && vnode.props.onVnodeUpdated,
    vnode,
    prevVNode,
  )
  if (vnode.iu) vnode.iu()
}

// Renderer-driven update: props first, then the hooks, as in VDOM.
function updateInteropVNode(
  instance: VaporComponentInstance,
  state: VNodeHookState,
  vnode: VNode,
  prevVNode: VNode,
): void {
  state.pendingVNodeUpdate = vnode
  instance.rawPropsRef!.value = filterReservedProps(vnode.props)
  instance.rawSlotsRef!.value = normalizeInteropSlots(vnode.children)
  // align with VDOM: vnode beforeUpdate runs before directive beforeUpdate.
  invokeInteropVNodeBeforeUpdate(instance, vnode, prevVNode)
  updateInteropDirs(instance, state, vnode, prevVNode)
  queuePostFlushCb(() => {
    syncVNodeEl(vnode, instance)
    // The ref writes scheduled no render effect (no `u` will consume the
    // token) when the instance is not mid-update by post-flush time; a
    // newer driven update owns the slot if the token is no longer ours.
    if (state.pendingVNodeUpdate === vnode && !instance.isUpdating) {
      state.pendingVNodeUpdate = null
    }
  })
  if ((vnode.props && vnode.props.onVnodeUpdated) || vnode.iu) {
    queuePostRenderEffect(
      () => invokeInteropVNodeUpdated(instance, vnode, prevVNode),
      undefined,
      instance.suspense,
    )
  }
}

interface VNodeHookState {
  vnode: VNode
  // The vnode whose renderer-driven update is in flight. Its vapor flush must
  // not re-fire the vnode hooks the renderer already owns for that patch:
  // `bu` skips while it is set and `u` consumes it. The post-flush fallback
  // in update()/activate() clears only its own token — identity, not timing,
  // decides — covering ref writes that scheduled no render effect.
  pendingVNodeUpdate: VNode | null
  dirsOwners: Map<VaporComponentInstance, InteropDirsOwner> | null
  // bindings a renderer-driven update handed down, with what each component
  // had, until the chain settles
  dirsReceived: [InteropDirsOwner, VNode][] | null
}

const vnodeHookStateMap = new WeakMap<VaporComponentInstance, VNodeHookState>()

function ensureVNodeHookState(
  instance: VaporComponentInstance,
  vnode: VNode,
): VNodeHookState {
  // Publish current event inputs even when the component update is skipped.
  instance.interopVNode = vnode

  let state = vnodeHookStateMap.get(instance)
  if (!state) {
    state = {
      vnode,
      pendingVNodeUpdate: null,
      dirsOwners: null,
      dirsReceived: null,
    }
    vnodeHookStateMap.set(instance, state)
    ;(instance.bu ||= []).push(() => {
      if (state!.pendingVNodeUpdate) return
      // align with VDOM: vnode beforeUpdate runs before directive beforeUpdate.
      invokeInteropVNodeBeforeUpdate(instance, state!.vnode, state!.vnode)
      beforeInteropDirsSelfUpdate(instance, state!, instance)
    })

    // Sync the outer component vnode before running any updated hooks. Hooks
    // that depend on the latest root, like scoped CSS interop, run immediately
    // after the sync and before component updated hooks / onVnodeUpdated.
    ;(instance.u ||= []).unshift(() => {
      syncInteropRoot(instance)
      // align with VDOM: directive updated runs before the component's own
      // updated hooks, vnode updated after them.
      afterInteropDirsSelfUpdate(instance, state!, instance)
    })
    instance.u.push(() => {
      if (state!.pendingVNodeUpdate) {
        state!.pendingVNodeUpdate = null
        return
      }
      invokeInteropVNodeUpdated(instance, state!.vnode, state!.vnode)
    })
  } else {
    state.vnode = vnode
  }
  return state
}

function createVNodeChildrenFragment(
  internals: RendererInternals,
  render: () => VNode[],
  parentComponent: ComponentInternalInstance | null,
): VaporFragment {
  let suspense =
    currentRenderContext.suspense ||
    (parentComponent && parentComponent.suspense)
  const frag = createInteropFragment()
  const content = new InteropContentState()
  // `isBlockValid` reports `content.valid` (VDOM-side `ensureValidVNode`), not
  // `isValidBlock(frag.nodes)`.
  frag.isBlockValid = () => (content.resolved ? content.valid : true)
  let currentVNode: VNode | null = null
  let currentChildren: VNode[] = EMPTY_VNODES
  let currentParentNode: ParentNode | null = null
  // Captured once from the real DOM container, mirroring how VDOM closes the
  // mount-time namespace over a component's render effect.
  let childrenNamespace: ElementNamespace
  let currentAnchor: Node | null = null
  let isMounted = false
  let isRenderEffectStarted = false
  const scope = effectScope()
  const cleanupInvalidContent = () => {
    if (currentParentNode) {
      removeAttachedNodes(frag.nodes, currentParentNode)
    }
  }
  if (frag.slotBoundary) {
    registerContentInvalid(frag.slotBoundary, cleanupInvalidContent, frag)
  }

  const syncResolvedNodes = (children: VNode[] = currentChildren): boolean => {
    const prevValid = content.resolved ? content.valid : true
    content.valid = !!ensureValidVNode(children)
    if (children.length === 0) {
      frag.nodes = EMPTY_BLOCK
    } else if (children.length === 1) {
      frag.nodes = resolveVNodeNodes(children[0])
    } else {
      frag.nodes = children.map(resolveVNodeNodes) as Block[]
    }
    content.resolved = true
    return prevValid !== content.valid
  }
  const syncResolvedNodesAndCleanup = (
    children: VNode[] = currentChildren,
  ): boolean => {
    const validityChanged = syncResolvedNodes(children)
    if (!content.valid && frag.slotBoundary) {
      cleanupInvalidContent()
      currentVNode = null
      currentChildren = EMPTY_VNODES
    }
    return validityChanged
  }

  const notifyUpdated = (validityChanged = false): void => {
    if (validityChanged && frag.slotBoundary) {
      frag.slotBoundary.markDirty()
    }
    if (isMounted && frag.u) {
      frag.u.forEach(hook => hook(frag.nodes))
    }
  }
  const notifyBeforeUpdate = (): void => {
    if (isMounted && frag.bu) {
      frag.bu.forEach(hook => hook())
    }
  }

  const renderContent = () => {
    const prev = currentInstance
    simpleSetCurrentInstance(parentComponent)
    try {
      renderEffect(() => {
        withRenderContext(frag.ctx, () => {
          const nextChildren = render()
          notifyBeforeUpdate()
          if (isHydrating) {
            nextChildren.forEach(vnode =>
              hydrateVNode(vnode, parentComponent, frag.slotScopeIds),
            )
            currentChildren = nextChildren
            currentVNode = createVNode(Fragment, null, nextChildren)
            currentParentNode = currentHydrationNode!.parentNode as ParentNode
            childrenNamespace = getContainerType(currentParentNode as Element)
            currentAnchor = currentHydrationNode
          } else if (!isMounted) {
            currentChildren = nextChildren
            currentVNode = createVNode(Fragment, null, nextChildren)
            const wasResolved = content.resolved
            const validityChanged = syncResolvedNodes(nextChildren)
            if (wasResolved) {
              notifyUpdated(validityChanged)
            }
            return
          } else if (!currentVNode) {
            currentChildren = nextChildren
            currentVNode = createVNode(Fragment, null, nextChildren)
            trackSlotVNodeUpdatesWithRefresh(
              currentVNode,
              () => {
                notifyUpdated(syncResolvedNodesAndCleanup(nextChildren))
              },
              notifyBeforeUpdate,
            )
            if (nextChildren.length) {
              internals.mc(
                nextChildren,
                currentParentNode!,
                currentAnchor,
                parentComponent,
                suspense,
                childrenNamespace,
                frag.slotScopeIds,
                false,
              )
            }
          } else {
            const nextVNode = createVNode(Fragment, null, nextChildren)
            trackSlotVNodeUpdatesWithRefresh(
              nextVNode,
              () => {
                notifyUpdated(syncResolvedNodesAndCleanup(nextChildren))
              },
              notifyBeforeUpdate,
            )
            internals.pc(
              currentVNode,
              nextVNode,
              currentParentNode!,
              currentAnchor,
              parentComponent,
              suspense,
              childrenNamespace,
              frag.slotScopeIds,
              false,
            )
            currentChildren = nextChildren
            currentVNode = nextVNode
          }

          const validityChanged = syncResolvedNodesAndCleanup()
          if (isHydrating) {
            if (isMounted && frag.u) {
              frag.u.forEach(hook => hook(frag.nodes))
            }
          } else {
            notifyUpdated(validityChanged)
          }
        })
      })
    } finally {
      simpleSetCurrentInstance(prev)
    }
  }

  const startRenderEffect = (): void => {
    if (isRenderEffectStarted) {
      return
    }
    isRenderEffectStarted = true
    scope.run(renderContent)
  }

  if (!isHydrating) {
    startRenderEffect()
  }

  const place = (
    parentNode: ParentNode,
    anchor: Node | null,
    parentSuspense: SuspenseBoundary | null | undefined,
    moveType = MoveType.REORDER,
  ) => {
    if (isHydrating) return
    if (parentSuspense !== undefined) suspense = parentSuspense
    currentParentNode = parentNode
    currentAnchor = anchor
    if (!isMounted) {
      childrenNamespace = getContainerType(parentNode as Element)
      startRenderEffect()
      if (currentVNode) {
        trackSlotVNodeUpdatesWithRefresh(
          currentVNode,
          () => {
            notifyUpdated(syncResolvedNodesAndCleanup(currentChildren))
          },
          notifyBeforeUpdate,
        )
      }
      if (currentChildren.length) {
        internals.mc(
          currentChildren,
          currentParentNode,
          currentAnchor,
          parentComponent,
          suspense,
          childrenNamespace,
          frag.slotScopeIds,
          false,
        )
      }
      syncResolvedNodes()
      isMounted = true
    } else if (!isHydratingSlotFallback) {
      // adopted from the server: it stays where it is
      currentChildren.forEach(vnode => {
        internals.m(
          vnode,
          parentNode,
          anchor,
          moveType,
          parentComponent as any,
          suspense,
        )
      })
    }
  }
  frag.insert = (parentNode, anchor, parentSuspense) =>
    place(parentNode, anchor, parentSuspense)
  frag.move = (
    parentNode,
    anchor,
    moveType,
    _parentComponent,
    parentSuspense,
  ) => place(parentNode, anchor, parentSuspense, moveType)

  frag.remove = parentNode => {
    scope.stop()
    const parentSuspense = resolveUnmountSuspense(suspense)
    currentChildren.forEach(vnode => {
      internals.um(vnode, parentComponent, parentSuspense, !!parentNode)
    })
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    startRenderEffect()
    isMounted = true
  }

  return frag
}

function isSameResolvedOutput(prev: Block, next: Block): boolean {
  return (
    prev === next ||
    (isArray(prev) &&
      isArray(next) &&
      prev.length === next.length &&
      prev.every((node, index) => node === next[index]))
  )
}

function normalizeInteropSlots(rawSlots: any): any {
  if (rawSlots == null) return EMPTY_OBJ
  // VDOM children bypass runtime-core's component slot initialization here,
  // so normalize raw children into a callable default slot first.
  if (!isObject(rawSlots) || isArray(rawSlots) || isVNode(rawSlots)) {
    return normalizeInteropDefaultSlot(rawSlots)
  }

  // VDOM render-function slots can return a single VNode, but renderSlot()
  // consumes normalized slots that return VNode arrays.
  const normalized = createInternalObject() as any
  for (const key in rawSlots) {
    if (isInternalSlotKey(key)) continue

    const slot = rawSlots[key]
    if (isFunction(slot)) {
      // Already-normalized VDOM slots and Vapor slots carry their own runtime
      // protocol markers, so keep them intact.
      normalized[key] =
        (slot as any)[rawVaporSlotKey] || (slot as any)._n
          ? slot
          : normalizeInteropSlot(slot, rawSlots._ctx)
    } else if (slot != null) {
      normalized[key] = () => normalizeInteropSlotValue(slot)
    }
  }
  // Preserve VDOM slot metadata for renderSlot() while keeping it hidden from
  // Vapor useSlots() enumeration.
  ;(['_', '_ctx', '$stable'] as const).forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(rawSlots, key)
    if (descriptor) {
      Object.defineProperty(normalized, key, descriptor)
    }
  })
  return normalized
}

type InteropSlotCacheEntry = {
  noCtx?: Slot
  ctx?: WeakMap<ComponentInternalInstance, Slot>
}
const interopSlotCache = new WeakMap<Function, InteropSlotCacheEntry>()

function normalizeInteropSlot(
  rawSlot: Function,
  ctx: ComponentInternalInstance | null | undefined,
): Slot {
  let cache = interopSlotCache.get(rawSlot)
  if (!cache) {
    interopSlotCache.set(rawSlot, (cache = {}))
  }
  if (ctx) {
    let ctxCache = cache.ctx
    if (!ctxCache) {
      cache.ctx = ctxCache = new WeakMap()
    }
    const cached = ctxCache.get(ctx)
    if (cached) return cached
    const normalized = createNormalizedInteropSlot(rawSlot, ctx)
    ctxCache.set(ctx, normalized)
    return normalized
  }
  if (cache.noCtx) return cache.noCtx
  return (cache.noCtx = createNormalizedInteropSlot(rawSlot, ctx))
}

function createNormalizedInteropSlot(
  rawSlot: Function,
  ctx: ComponentInternalInstance | null | undefined,
): Slot {
  const normalized = withCtx(
    (...args: any[]) => normalizeInteropSlotValue(rawSlot(...args)),
    ctx,
  ) as Slot
  ;(normalized as any)._c = false
  return normalized
}

function normalizeInteropDefaultSlot(value: unknown): Slots {
  const normalized = createInternalObject() as any
  const normalizedValue = normalizeInteropSlotValue(value)
  normalized.default = () => normalizedValue
  return normalized
}

function normalizeInteropSlotValue(value: unknown): VNode[] {
  return isArray(value)
    ? value.map(child => normalizeVNode(child as any))
    : [normalizeVNode(value as any)]
}

const isInternalSlotKey = (key: string): boolean =>
  key === '_' || key === '_ctx' || key === '$stable' || key === '$'

const interopSlotsSourceHandlers: ProxyHandler<ShallowRef<Slots>> = {
  get(target, key: any) {
    const slots = target.value
    return slots && slots[key]
  },
  has(target, key: any) {
    const slots = target.value
    return !!slots && key in slots
  },
  ownKeys(target) {
    const slots = target.value
    return slots
      ? Object.keys(slots).filter(key => !isInternalSlotKey(key))
      : EMPTY_ARR
  },
  getOwnPropertyDescriptor(target, key: any) {
    const slots = target.value
    const descriptor = slots && Object.getOwnPropertyDescriptor(slots, key)
    if (descriptor && descriptor.enumerable && !isInternalSlotKey(key)) {
      return {
        enumerable: true,
        configurable: true,
        value: descriptor.value,
      }
    }
  },
}

function createInteropRawSlots(slotsRef: ShallowRef<Slots>): RawSlots {
  // `interopSlotsKey` keeps direct <slot> outlets on the VDOM slot path
  // (createSlot reads it); `$` exposes live slot keys to Vapor useSlots() /
  // dynamic forwarding. The symbol key is invisible to string-keyed slot
  // enumeration, so no defineProperty hiding is needed.
  return {
    $: [new Proxy(slotsRef, interopSlotsSourceHandlers)],
    [interopSlotsKey]: slotsRef,
  } as any as RawSlots
}

// vnode.el of an interop-mounted vapor component must follow its dynamic
// root across branch switches.
const interopRootSyncFragmentMap = new WeakMap<
  DynamicFragment,
  VaporComponentInstance
>()

function registerInteropRootSync(
  instance: VaporComponentInstance,
  frag: DynamicFragment,
): void {
  if (interopRootSyncFragmentMap.get(frag) === instance) return
  interopRootSyncFragmentMap.set(frag, instance)
  ;(frag.u ||= []).push(() => syncInteropRoot(instance))
}

// Registered on demand: only instances whose vnode carries directives
// resolve through `resolveInteropDirsRoot`.
const interopDirsProducers = new WeakSet<
  DynamicFragment | VaporComponentInstance
>()

// A branch switch is the vdom unmount + mount of the inherited root vnode: a
// root directly in the old branch is released while still in the DOM (`bu`),
// the new one is mounted before it is inserted (`bm`). A root rendered by a
// nested component goes with that component instead, which keeps it across a
// KeepAlive deactivation. `inherit` is the record of the component the
// fragment renders in; the fragment dies with that component.
function registerInteropDirsFragment(
  instance: VaporComponentInstance,
  state: VNodeHookState,
  frag: DynamicFragment,
  inherit: InteropDirsOwner,
): void {
  registerInteropRootSync(instance, frag)
  if (interopDirsProducers.has(frag)) return
  interopDirsProducers.add(frag)
  let reactivated: InteropDirsOwner | null = null
  ;(frag.bu ||= []).push(() => {
    if (inherit.el && inherit.el === getRootElement(frag.nodes)) {
      unmountInteropDirsRoot(instance, inherit)
    }
  })
  ;(frag.bm ||= []).push(nodes => {
    if (!inherit.vnode.dirs || !isOnInteropRootChain(inherit.comp, frag)) return
    const [owner, el] = resolveInteropDirsRoot(instance, state, nodes, inherit)
    if (!el) return
    if (owner.el === el) {
      // a reactivated root: vdom patches it once it is back in the DOM
      if (!owner.pending) owner.pending = owner.carried
      reactivated = owner
    } else {
      mountInteropDirsRoot(instance, owner, el)
    }
  })
  ;(frag.u ||= []).push(() => {
    // the branch switch is done: the chain has settled
    settleInteropDirsReceived(instance, state)
    const owner = reactivated
    reactivated = null
    if (
      !owner ||
      !owner.el ||
      !owner.pending ||
      isInteropDirsUpdating(state, owner)
    ) {
      return
    }
    // the activation patch is owed to the component's own re-render when it
    // has one (new props), and runs on its own otherwise
    owner.updating = owner.comp
    owner.patching = owner
    invokeInteropDirsHook(
      instance,
      owner.el,
      owner.vnode,
      'beforeUpdate',
      owner.pending,
    )
    queueInteropDirsJob(instance, () =>
      afterInteropDirsSelfUpdate(instance, state, owner.comp),
    )
  })
}

function registerInteropDirsComponent(
  instance: VaporComponentInstance,
  state: VNodeHookState,
  comp: VaporComponentInstance,
): void {
  if (comp === instance || interopDirsProducers.has(comp)) return
  interopDirsProducers.add(comp)
  ;(comp.bu ||= []).push(() =>
    beforeInteropDirsSelfUpdate(instance, state, comp),
  )
  // align with VDOM: directive updated runs before the component's own
  ;(comp.u ||= []).unshift(() =>
    afterInteropDirsSelfUpdate(instance, state, comp),
  )
  ;(comp.bum ||= []).push(() => unmountInteropDirs(instance, state, comp))
}

function isOnInteropRootChain(
  from: VaporComponentInstance,
  producer: DynamicFragment | VaporComponentInstance,
): boolean {
  let found = false
  getRootElement(from, {
    excludeSlotOutlets: true,
    // mid-render `frag.nodes` is still the previous branch: stop at the match
    onDynamicFragment: frag => frag === producer && (found = true),
    onComponent: comp => comp === producer && (found = true),
  })
  return found
}

/**
 * Stores the vnode-derived root-only ids on the instance. Metadata only:
 * mountComponent and dynamic branch renders apply them pre-insert to roots
 * that mount afterwards; kept roots keep their mount-time ids (VDOM parity).
 */
function setInteropComponentScopeIds(
  instance: VaporComponentInstance,
  vnode: VNode,
): void {
  instance.scopeId = vnode.scopeId
  const inherited = getInheritedScopeIds(
    vnode,
    instance.parent as ComponentInternalInstance | null,
  )
  instance.slotScopeIds = concatInteropScopeIds(
    vnode.slotScopeIds,
    inherited.length ? inherited : null,
  )
}

function concatInteropScopeIds(
  base: string[] | null,
  own: string[] | null | undefined,
): string[] | null {
  // identity guard: a content vnode's recorded context can BE the base cell
  // (stored by reference through the patch context) — self-concat would
  // duplicate every id
  return base
    ? own && own.length && own !== base
      ? base.concat(own)
      : base
    : own || null
}

/**
 * Publishes root-only ids onto the interop vnode backing a vapor component's
 * effective root, for core to apply at its own pre-insertion mount. A nested
 * component crossed during the descent re-collects canonically — its climb
 * carries every ancestor's contribution — superseding the caller's subset.
 */
function publishVaporScopeIds(block: Block, scopeIds: string[]): void {
  let currentScopeIds = scopeIds
  getRootElement(block, {
    onComponent: instance => {
      currentScopeIds = collectRootScopeIds(instance) || []
    },
    onInteropFragment: frag => {
      if (frag.vnode) {
        setVNodeVaporScopeIds(frag.vnode, currentScopeIds)
        return true
      }
    },
    excludeSlotOutlets: true,
  })
}

function setVNodeVaporScopeIds(vnode: VNode, scopeIds: string[]): void {
  vnode.vaporScopeIds = scopeIds
  // Pending suspense branches mount through core with no vapor seam between;
  // forward so both branches inherit at their own mount.
  if (vnode.ssContent) setVNodeVaporScopeIds(vnode.ssContent, scopeIds)
  if (vnode.ssFallback) setVNodeVaporScopeIds(vnode.ssFallback, scopeIds)
}

// The single merge point for a vapor slot's id cell: raw patch context, the
// vnode's own ids, then deep slot-content inheritance (root-only excluded).
function getInteropVaporSlotScopeIds(
  contextSlotScopeIds: string[] | null,
  own: string[] | null,
  inherited: string[],
): string[] | null {
  return concatInteropScopeIds(
    concatInteropScopeIds(contextSlotScopeIds, own),
    inherited.length ? inherited : null,
  )
}

// The cell of an outlet enclosing the slot: the patch context without the ids
// of the `innerIds` fragments inside that outlet, nor the slot vnode's own.
function getEnclosingOutletScopeIds(
  context: string[] | null,
  innerIds: number,
  inherited: string[],
): string[] | null {
  const kept = context && innerIds ? context.slice(0, -innerIds) : context
  return getInteropVaporSlotScopeIds(
    kept && kept.length ? kept : null,
    null,
    inherited,
  )
}

// Interop fragment protocol: shared implementations (no per-fragment
// closures) over the backing vnode. All report "nothing" while the fragment
// exposes vapor fallback content (vnode === null).
function interopHasVDOMContent(this: VaporFragment): boolean {
  return !!this.vnode
}

function interopSetKey(this: VaporFragment, key: any): void {
  if (this.vnode) this.vnode.key = key
}

function interopGetTransitionType(this: VaporFragment): any {
  return this.vnode ? getInteropTransitionType(this.vnode) : undefined
}

function interopGetTransitionElement(this: VaporFragment): Element | undefined {
  return this.vnode ? getInteropTransitionElement(this.vnode) : undefined
}

function createInteropFragment(
  nodes: Block = EMPTY_BLOCK,
  vnode: VNode | null = null,
  extraFlags = 0,
): RenderContextFragment<Block> {
  const frag = new RenderContextFragment<Block>(nodes, VDOM | extraFlags)
  frag.vnode = vnode
  frag.hasVDOMContent = interopHasVDOMContent
  frag.setKey = interopSetKey
  frag.getTransitionType = interopGetTransitionType
  frag.getTransitionElement = interopGetTransitionElement
  return frag
}
