import {
  type App,
  type ComponentInternalInstance,
  type ConcreteComponent,
  ErrorCodes,
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
  type TransitionHooks,
  type VNode,
  type VNodeArrayChildren,
  type VNodeNormalizedRef,
  type VaporInteropInterface,
  VaporSlot as VaporSlotVNode,
  callWithAsyncErrorHandling,
  createInternalObject,
  createVNode,
  currentInstance,
  ensureHydrationRenderer,
  ensureRenderer,
  ensureValidVNode,
  ensureVaporSlotFallback,
  getInheritedScopeIds,
  getTransitionRawChildren,
  invokeDirectiveHook,
  isEmitListener,
  isKeepAlive,
  isVNode,
  isHydrating as isVdomHydrating,
  isHydratingEnabled as isVdomHydratingEnabled,
  normalizeRef,
  normalizeVNode,
  onScopeDispose,
  queuePostFlushCb,
  queuePostRenderEffect,
  renderSlot,
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
  unmountComponent,
} from './component'
import { getCurrentScopeId, setScopeId } from './scopeId'
import type { LooseRawSlots } from './componentSlots'
import {
  type Block,
  type BlockFn,
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
  ShapeFlags,
  extend,
  isArray,
  isFunction,
  isObject,
  isReservedProp,
  isString,
} from '@vue/shared'
import {
  type RawProps,
  rawPropsProxyHandlers,
  setupPropsValidation,
} from './componentProps'
import type { RawSlots, VaporSlot } from './componentSlots'
import {
  currentSlotScopeIds,
  dynamicSlotsProxyHandlers,
  getSlot,
  withOnceSlot,
} from './componentSlots'
import { renderEffect } from './renderEffect'
import { createTextNode, parentNode } from './dom/node'
import { optimizePropertyLookup } from './dom/prop'
import {
  advanceHydrationNode,
  currentHydrationNode,
  isComment,
  isHydrating,
  isHydrationAnchor,
  locateEndAnchor,
  setCurrentHydrationNode,
  hydrateNode as vaporHydrateNode,
} from './dom/hydration'
import {
  type DynamicFragment,
  RenderContextFragment,
  type SlotFragment,
  type VaporFragment,
  isFragment,
  isSlotFragment,
  runWithFragmentCtxOnly,
  runWithRenderCtx,
} from './fragment'
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
  markSlotResolutionDirty,
  recheckSlotResolution,
} from './slotFragment'
import {
  getCurrentSlotEndAnchor,
  startPendingSlotContent,
  withHydratingSlotBoundary,
} from './dom/hydrateFragment'
import type { NodeRef } from './apiTemplateRef'
import {
  ensureTransitionHooksRegistered,
  setTransitionHooks as setVaporTransitionHooks,
} from './components/Transition'
import { registerTransitionInterop } from './transition'
import { interopKey, setInteropEnabled } from './vdomInteropState'
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
  parentSuspense as currentParentSuspense,
  enableSuspense,
  isSuspenseEnabled,
  setParentSuspense,
} from './suspense'

const EMPTY_BLOCK = EMPTY_ARR as unknown as Block[]
const EMPTY_VNODES = EMPTY_ARR as unknown as VNode[]

function getRawTransitionChild(vnode: VNode | undefined): VNode | undefined {
  if (!vnode) return
  const children = getTransitionRawChildren([vnode])
  return children.length === 1 ? children[0] : undefined
}

function getInteropTransitionType(vnode: VNode): VNode['type'] | undefined {
  const child = getRawTransitionChild(vnode)
  return child && child.type
}

function getVNodeKey(vnode: VNode | undefined): VNode['key'] | undefined {
  const child = getRawTransitionChild(vnode)
  return child && child.key
}

function getInteropTransitionElement(vnode: VNode): Element | undefined {
  if (vnode.component) {
    return getInteropTransitionElement(vnode.component.subTree)
  }
  if (vnode.el instanceof Element) {
    return vnode.el
  }
  if (vnode.type === Fragment) {
    const child = getRawTransitionChild(vnode)
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
const vaporInteropImpl: Omit<
  VaporInteropInterface,
  'vdomMount' | 'vdomUnmount' | 'vdomSlot' | 'vdomMountVNode'
> = {
  mount(
    vnode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    onBeforeMount,
    onVnodeBeforeMount,
  ) {
    const selfAnchor = (vnode.anchor = createTextNode())
    vnode.el = selfAnchor
    container.insertBefore(selfAnchor, anchor)
    const prev = currentInstance
    simpleSetCurrentInstance(parentComponent)

    const propsRef = shallowRef(filterReservedProps(vnode.props))
    const slotsRef = shallowRef(normalizeInteropSlots(vnode.children))
    const rawSlots = createInteropRawSlots(slotsRef)

    let prevSuspense: SuspenseBoundary | null = null
    if (__FEATURE_SUSPENSE__ && isSuspenseEnabled && parentSuspense) {
      prevSuspense = setParentSuspense(parentSuspense)
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
    const applyScopeId = (vnode: VNode) =>
      setInteropVnodeScopeId(
        instance,
        vnode,
        instance.parent as ComponentInternalInstance | null,
      )
    vnodeHookState.postRootSyncHooks.push(applyScopeId)

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

    if (__FEATURE_SUSPENSE__ && isSuspenseEnabled && parentSuspense) {
      setParentSuspense(prevSuspense)
    }

    const rootEl = getRootElement(instance)
    if (rootEl) {
      vnode.el = rootEl
    }
    // align with VDOM: vnode beforeMount runs before directive created/beforeMount.
    onVnodeBeforeMount && onVnodeBeforeMount()
    // invoke directive hooks only when we have a valid root element
    if (vnode.dirs) {
      if (rootEl) {
        onBeforeMount && onBeforeMount()
      } else {
        if (__DEV__) {
          warn(
            `Runtime directive used on component with non-element root node. ` +
              `The directives will not function as intended.`,
          )
        }
        vnode.dirs = null
      }
    }

    mountComponent(instance, container, selfAnchor)
    if (!isHydrating) applyScopeId(vnodeHookState.vnode)

    simpleSetCurrentInstance(prev)
    return instance
  },

  update(n1, n2, shouldUpdate, onBeforeUpdate, onVnodeBeforeUpdate) {
    n2.component = n1.component
    n2.el = n1.el
    n2.anchor = n1.anchor

    const instance = n2.component as any as VaporComponentInstance
    const vnodeHookState = ensureVNodeHookState(instance, n2)

    if (shouldUpdate) {
      const rootEl = getRootElement(instance)
      if (rootEl) {
        n2.el = rootEl
      }
      // align with VDOM: vnode beforeUpdate runs before directive beforeUpdate.
      onVnodeBeforeUpdate && onVnodeBeforeUpdate()
      // invoke directive hooks only when we have a valid root element
      if (n2.dirs) {
        if (rootEl) {
          onBeforeUpdate && onBeforeUpdate()
        } else {
          n2.dirs = null
        }
      }
      vnodeHookState.skipVnodeHooks = true
      if (n2.transition && instance.block) {
        ensureTransitionHooksRegistered()
        setVaporTransitionHooks(instance, n2.transition as VaporTransitionHooks)
      }
      instance.rawPropsRef!.value = filterReservedProps(n2.props)
      instance.rawSlotsRef!.value = normalizeInteropSlots(n2.children)
      queuePostFlushCb(() => {
        syncVNodeEl(n2, instance)
        setInteropVnodeScopeId(
          instance,
          n2,
          instance.parent as ComponentInternalInstance | null,
        )
        if (!instance.isUpdating) {
          vnodeHookState.skipVnodeHooks = false
        }
      })
    }
  },

  unmount(vnode, doRemove, parentSuspense) {
    const container = doRemove ? vnode.anchor!.parentNode : undefined
    const instance = vnode.component as any as VaporComponentInstance
    let slotStartAnchor: Node | null = null
    if (instance) {
      const anchor = vnode.anchor as Node | null
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
        // The async Vapor component may not be resolved yet, so block is null.
        // Hydration still adopted SSR DOM on vnode.el; when this VNode owns
        // removal, clear the adopted range before the interop anchor.
        const adoptedNode =
          vnode.el && vnode.el !== anchor ? (vnode.el as Node) : null
        unmountComponent(instance, undefined, parentSuspense)
        if (doRemove && container && adoptedNode) {
          let cur: Node | null = adoptedNode
          while (cur && cur !== anchor) {
            const nextNode: ChildNode | null = cur.nextSibling
            if (cur.parentNode === container) {
              remove(cur, container)
            }
            cur = nextNode
          }
        }
      }
    } else if (vnode.vb) {
      const anchor = vnode.anchor as Node | null
      // `hydrateSlot()` records the opening marker for VDOM SSR slot fragments
      // on vnode.el while vnode.anchor points at the closing marker.
      if (vnode.el && vnode.el !== anchor && isComment(vnode.el as Node, '[')) {
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
      remove(vnode.vb, blockContainer)
      stopVaporSlotScope(vnode)
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
    n1: VNode,
    n2: VNode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
  ) {
    if (!n1) {
      // mount
      const slotBlock = renderVaporSlot(n2, parentComponent, parentSuspense)
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
          n1.el && n1.el !== selfAnchor && isComment(n1.el as Node, '[')
            ? (n1.el as Node)
            : undefined
        const oldBlockOwnsAnchor =
          isFragment(n1.vb!) && n1.vb!.anchor === selfAnchor
        // remove old vapor block
        remove(n1.vb!, parent)
        stopVaporSlotScope(n1)
        const slotBlock = renderVaporSlot(n2, parentComponent, parentSuspense)
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

  move(vnode, container, anchor, moveType, parentSuspense) {
    if (
      vnode.el &&
      vnode.el !== vnode.anchor &&
      isComment(vnode.el as Node, '[')
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
    move(
      vnode.vb || (vnode.component as any),
      container,
      anchor,
      moveType,
      undefined,
      parentSuspense,
    )
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
    node,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    onBeforeMount,
    onVnodeBeforeMount,
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
        onBeforeMount,
        onVnodeBeforeMount,
      ) as VaporComponentInstance
    })
    if (instance && instance.asyncDep && !instance.asyncResolved) {
      // mount() cannot expose a block before async setup resolves. Keep the SSR
      // start node so unmount can remove the adopted range if it is discarded.
      vnode.el = node
    }
    return anchor
  },

  hydrateSlot(vnode, node, parentComponent, parentSuspense) {
    if (!isHydrating && !isVdomHydrating && !isVdomHydratingEnabled) {
      return node
    }
    const container = parentNode(node)!
    let createdAnchor = false
    let resumeNode: Node | null = null
    vaporHydrateNode(node, () => {
      vnode.vb = renderVaporSlot(vnode, parentComponent, parentSuspense)
      const fragmentAnchor = isFragment(vnode.vb) && vnode.vb.anchor
      let anchor = fragmentAnchor || currentHydrationNode!
      const wrapped = isComment(node, '[') && isComment(anchor, ']')
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
      if (isComment(node, '[') && isComment(anchor, ']')) {
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
    return isComment(node, '[')
      ? (vnode.anchor as Node).nextSibling
      : (vnode.anchor as Node)
  },

  setTransitionHooks(component, hooks) {
    ensureTransitionHooksRegistered()
    setVaporTransitionHooks(component as any, hooks as VaporTransitionHooks)
  },

  activate(vnode, container, anchor, parentComponent, parentSuspense) {
    const cached = (parentComponent.ctx as KeepAliveContext).getCachedComponent(
      vnode,
    )
    vnode.el = cached.el
    vnode.component = cached.component
    vnode.anchor = cached.anchor
    const instance = vnode.component as any as VaporComponentInstance
    const vnodeHookState = ensureVNodeHookState(instance, vnode)
    const rootEl = getRootElement(instance)
    if (rootEl) {
      vnode.el = rootEl
    }
    if (vnode.dirs && !rootEl) {
      if (__DEV__) {
        warn(
          `Runtime directive used on component with non-element root node. ` +
            `The directives will not function as intended.`,
        )
      }
      vnode.dirs = null
    }
    const shouldUpdate = shouldUpdateComponent(cached, vnode)
    if (shouldUpdate) {
      vnodeHookState.skipVnodeHooks = true
      instance.rawPropsRef!.value = filterReservedProps(vnode.props)
      instance.rawSlotsRef!.value = normalizeInteropSlots(vnode.children)
      const vnodeBeforeUpdateHook =
        vnode.props && vnode.props.onVnodeBeforeUpdate
      if (vnodeBeforeUpdateHook) {
        callWithAsyncErrorHandling(
          vnodeBeforeUpdateHook,
          parentComponent,
          ErrorCodes.VNODE_HOOK,
          [vnode, cached],
        )
      }
      if (vnode.dirs) {
        invokeDirectiveHook(vnode, cached, parentComponent, 'beforeUpdate')
      }
      queuePostFlushCb(() => {
        syncVNodeEl(vnode, instance)
        if (!instance.isUpdating) {
          vnodeHookState.skipVnodeHooks = false
        }
      })
      queuePostRenderEffect(
        () => {
          if (vnode.dirs) {
            invokeDirectiveHook(vnode, cached, parentComponent, 'updated')
          }
          const vnodeUpdatedHook = vnode.props && vnode.props.onVnodeUpdated
          if (vnodeUpdatedHook) {
            callWithAsyncErrorHandling(
              vnodeUpdatedHook,
              parentComponent,
              ErrorCodes.VNODE_HOOK,
              [vnode, cached],
            )
          }
        },
        undefined,
        parentSuspense,
      )
    }
    activate(instance, container, anchor, parentSuspense)
    insert(vnode.anchor as any, container, anchor)
    const vnodeMountedHook = vnode.props && vnode.props.onVnodeMounted
    if (vnodeMountedHook) {
      queuePostRenderEffect(
        () => {
          callWithAsyncErrorHandling(
            vnodeMountedHook,
            parentComponent,
            ErrorCodes.VNODE_HOOK,
            [vnode],
          )
        },
        undefined,
        parentSuspense,
      )
    }
  },

  deactivate(vnode, container, parentSuspense) {
    const instance = vnode.component as any as VaporComponentInstance
    deactivate(instance, container, parentSuspense)
    insert(vnode.anchor as any, container)
    queuePostRenderEffect(
      () => {
        const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted
        if (vnodeHook) {
          callWithAsyncErrorHandling(
            vnodeHook,
            instance.parent,
            ErrorCodes.VNODE_HOOK,
            [vnode],
          )
        }
      },
      undefined,
      parentSuspense,
    )
  },
}

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
      slot.__vapor = true
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
      ;(wrapped as any).__vs = slot
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

function appendVnodeHook(
  vnode: VNode,
  key: 'onVnodeBeforeUpdate' | 'onVnodeUpdated',
  hook: () => void,
): void {
  const props = (vnode.props ||= {})
  const existing = props[key]
  props[key] = existing
    ? isArray(existing)
      ? [...existing, hook]
      : [existing, hook]
    : hook
}

function trackFragmentVNodeUpdates(
  frag: VaporFragment,
  vnode: VNode,
  syncNodes: () => void,
): void {
  const beforeUpdate = () => {
    if (frag.onBeforeUpdate) {
      frag.onBeforeUpdate.forEach(bu => bu())
    }
  }
  const updated = () => {
    syncNodes()
    if (frag.onUpdated) {
      frag.onUpdated.forEach(u => u())
    }
  }
  appendVnodeHook(vnode, 'onVnodeBeforeUpdate', beforeUpdate)
  appendVnodeHook(vnode, 'onVnodeUpdated', updated)
}

function createVNodeFragment(vnode: VNode): {
  frag: VaporFragment<Block>
  syncNodes: () => void
} {
  const frag = createInteropFragment(EMPTY_BLOCK, vnode)
  frag.$key = vnode.key
  // Optimistic slot validity: `frag.nodes` stays EMPTY_BLOCK until `syncNodes`
  // runs (on insert), so report valid to keep a host boundary from mounting its
  // fallback before the content exists. This keeps the common (valid) case free —
  // an empty result is corrected later when the resolve path notifies the
  // boundary to recheck; starting invalid would instead mount-then-teardown the
  // fallback on every interop mount. Hydration starts resolved (SSR nodes exist).
  let contentResolved = isHydrating
  const syncNodes = () => {
    frag.nodes = resolveVNodeNodes(vnode)
    contentResolved = true
  }
  frag.isBlockValid = componentAsValid =>
    contentResolved ? isValidBlock(frag.nodes, componentAsValid) : true
  trackFragmentVNodeUpdates(frag, vnode, syncNodes)
  return { frag, syncNodes }
}

/**
 * Mount VNode in vapor
 */
function mountVNode(
  internals: RendererInternals,
  vnode: VNode,
  parentComponent: VaporComponentInstance | null,
): VaporFragment {
  const suspense =
    currentParentSuspense || (parentComponent && parentComponent.suspense)
  const { frag, syncNodes } = createVNodeFragment(vnode)

  let isMounted = false
  const unmount = (parentNode?: ParentNode, transition?: TransitionHooks) => {
    if (transition) setVNodeTransitionHooks(vnode, transition)
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      if ((vnode.type as any).__vapor) {
        deactivate(
          vnode.component as any,
          (parentComponent as KeepAliveInstance)!.ctx.getStorageContainer(),
        )
      } else {
        vdomDeactivate(
          vnode,
          (parentComponent as KeepAliveInstance)!.ctx.getStorageContainer(),
          internals,
          parentComponent as any,
          null,
        )
      }
    } else {
      internals.um(vnode, parentComponent as any, null, !!parentNode)
    }

    if (vnode.anchor && parentNode && vnode.anchor.parentNode === parentNode) {
      remove(vnode.anchor as Node, parentNode)
    }
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    hydrateVNode(vnode, parentComponent as any)
    onScopeDispose(unmount, true)
    isMounted = true
    syncNodes()
  }

  frag.insert = (parentNode, anchor, parentSuspense, transition) => {
    if (isHydrating) return
    const operationSuspense =
      parentSuspense === undefined ? suspense : parentSuspense
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      if ((vnode.type as any).__vapor) {
        activate(vnode.component as any, parentNode, anchor, operationSuspense)
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
        internals.p(
          null,
          vnode,
          parentNode,
          anchor,
          parentComponent as any,
          operationSuspense,
          undefined, // namespace
          vnode.slotScopeIds,
        )
        onScopeDispose(unmount, true)
        isMounted = true
      } else {
        // move
        internals.m(
          vnode,
          parentNode,
          anchor,
          MoveType.REORDER,
          parentComponent as any,
          operationSuspense,
        )
      }
      simpleSetCurrentInstance(prev)
    }
    syncNodes()
    if (isMounted && frag.onUpdated) frag.onUpdated.forEach(m => m())
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
  const suspense =
    currentParentSuspense || (parentComponent && parentComponent.suspense)
  const useBridge = shouldUseRendererBridge(component)
  const comp = useBridge ? ensureRendererBridge(component) : component
  const vnode = createVNode(
    comp,
    rawProps && extend({}, new Proxy(rawProps, rawPropsProxyHandlers)),
  )
  const { frag, syncNodes } = createVNodeFragment(vnode)
  const keepAliveCtx = isKeepAliveEnabled
    ? getKeepAliveContext(parentComponent)
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

  const wrapper = new VaporComponentInstance<Record<string, unknown>>(
    useBridge ? (comp as any) : { props: component.props },
    rawProps as RawProps,
    rawSlots as RawSlots,
    parentComponent ? parentComponent.appContext : undefined,
    once,
  )

  // overwrite how the vdom instance handles props
  vnode.vi = (instance: ComponentInternalInstance) => {
    // ensure props are shallow reactive to align with VDOM behavior.
    instance.props = shallowReactive(wrapper.props)

    const attrs = createInternalObject()
    const isFilteredEmit = (key: string | symbol): boolean =>
      typeof key === 'string' && isEmitListener(instance.emitsOptions, key)
    instance.attrs = new Proxy(attrs, {
      get(_, key: string | symbol) {
        if (isFilteredEmit(key)) return
        return wrapper.attrs[key as any]
      },
      has(_, key: string | symbol) {
        return !isFilteredEmit(key) && key in wrapper.attrs
      },
      ownKeys() {
        return Reflect.ownKeys(wrapper.attrs).filter(
          key => !isFilteredEmit(key),
        )
      },
      getOwnPropertyDescriptor(_, key: string | symbol) {
        if (!isFilteredEmit(key) && key in wrapper.attrs) {
          return {
            enumerable: true,
            configurable: true,
          }
        }
      },
    })

    instance.slots =
      wrapper.rawSlots === EMPTY_OBJ
        ? EMPTY_OBJ
        : new Proxy(wrapper.rawSlots, vaporSlotsProxyHandler)

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
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      vdomDeactivate(
        vnode,
        keepAliveCtx!.getStorageContainer(),
        internals,
        parentComponent as any,
        null,
      )
      return
    }
    isUnmounted = true
    isMounted = false
    internals.umt(vnode.component!, null, !!parentNode)
    // VDOM transitions own their leaving DOM until the leave finishes.
    if (!transition) removeDom(parentNode)
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    hydrateVNode(vnode, parentComponent as any)
    isMounted = true
    syncNodes()
  }

  vnode.scopeId = getCurrentScopeId() || null
  vnode.slotScopeIds = currentSlotScopeIds

  frag.insert = (parentNode, anchor, parentSuspense, transition) => {
    if (isHydrating) return
    const operationSuspense =
      parentSuspense === undefined ? suspense : parentSuspense
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
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
          undefined,
          false,
        )
        // set ref
        if (rawRef) vdomSetRef(rawRef, null, operationSuspense, vnode)
        isMounted = true
      } else {
        // move
        internals.m(
          vnode,
          parentNode,
          anchor,
          MoveType.REORDER,
          parentComponent as any,
          operationSuspense,
        )
      }
      simpleSetCurrentInstance(prev)
    }

    syncNodes()
    if (isMounted && frag.onUpdated) frag.onUpdated.forEach(m => m())
  }

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
        vdomSetRef(rawRef, oldRawRef, null, vnode)
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

function isSlotOutletOnlyVNode(vnode: VNode): boolean {
  if (vnode.type === VaporSlotVNode) {
    return true
  }

  return (
    vnode.type === Fragment &&
    isArray(vnode.children) &&
    (vnode.children as VNodeArrayChildren).every(
      child => isVNode(child) && isSlotOutletOnlyVNode(child),
    )
  )
}

// Forwarded VDOM slot fragments can hydrate against an already-empty SSR slot
// range in three shapes:
// 1. the parent slot boundary has already consumed `<!--[-->`, so hydration
//    resumes directly on the shared `<!--]-->`;
// 2. the fragment still owns `<!--[--><!--]-->`, and its own rendered content
//    stays empty, so the forwarded fragment should just reuse that empty range;
// 3. the fragment still owns `<!--[--><!--]-->`, but its children are only
//    nested Vapor slot outlets that must hydrate inside that empty range.
function hydrateForwardedEmptySlotFragment(
  vnode: VNode,
  parentComponent: VaporComponentInstance | null,
  contentValid: boolean,
): boolean {
  if (vnode.type !== Fragment || !isArray(vnode.children)) {
    return false
  }

  const children = vnode.children as VNodeArrayChildren
  // Case 1: an outer slot boundary has already consumed the fragment start
  // marker, so the forwarded fragment only sees the shared closing `<!--]-->`.
  const inheritedEmptySlotEndAnchor =
    isComment(currentHydrationNode!, ']') &&
    isComment(currentHydrationNode.previousSibling!, '[')
      ? currentHydrationNode
      : null
  const slotEndAnchor = getCurrentSlotEndAnchor() || inheritedEmptySlotEndAnchor
  const slotStartAnchor = slotEndAnchor && slotEndAnchor.previousSibling
  // Case 2: this forwarded fragment still owns an empty `<!--[--><!--]-->`
  // range, but the resolved content remains empty. Reuse that range as-is so
  // later updates patch inside the existing SSR anchors.
  if (
    !contentValid &&
    currentHydrationNode === slotEndAnchor &&
    slotStartAnchor &&
    isComment(slotStartAnchor, '[')
  ) {
    vnode.el = slotStartAnchor
    vnode.anchor = slotEndAnchor
    advanceHydrationNode(slotEndAnchor)
    return true
  }

  const isEmptyFragmentStart = isComment(currentHydrationNode!, '[')
  const hasSlotOutletChildren = children.length > 0
  const slotOutletOnlyChildren = children.every(
    child => isVNode(child) && isSlotOutletOnlyVNode(child),
  )
  if (
    !isEmptyFragmentStart ||
    !contentValid ||
    !hasSlotOutletChildren ||
    !slotOutletOnlyChildren
  ) {
    return false
  }

  const fragmentStartAnchor = currentHydrationNode as Comment
  const fragmentEndAnchor = locateEndAnchor(fragmentStartAnchor)
  if (
    !fragmentEndAnchor ||
    fragmentStartAnchor.nextSibling !== fragmentEndAnchor
  ) {
    return false
  }

  vnode.el = fragmentStartAnchor
  // Case 3: the forwarded fragment is structurally empty, but it still owns
  // nested Vapor slot outlets. Hydrate those outlets inside the fragment's SSR
  // range so they see the shared `<!--]-->` as their active slot boundary
  // instead of re-entering the same empty range through the generic Fragment
  // hydrator.
  withHydratingSlotBoundary(() => {
    children.forEach(child => {
      hydrateVNode(child as VNode, parentComponent as any)
    })
  })
  vnode.anchor = fragmentEndAnchor
  if (currentHydrationNode === fragmentEndAnchor) {
    advanceHydrationNode(fragmentEndAnchor)
  }
  return true
}

function trackSlotVNodeUpdatesWithRefresh(
  vnode: VNode,
  refresh: () => void,
  beforeUpdate?: () => void,
): void {
  const onUpdated = () => refresh()

  const track = (node: VNode) => {
    if (beforeUpdate) appendVnodeHook(node, 'onVnodeBeforeUpdate', beforeUpdate)
    appendVnodeHook(node, 'onVnodeUpdated', onUpdated)
    if (node.type === Fragment && isArray(node.children)) {
      node.children.forEach(child => {
        if (isVNode(child)) track(child)
      })
    }
  }

  track(vnode)
}

/**
 * Mount vdom slot in vapor
 */
function renderVDOMSlot(
  internals: RendererInternals,
  slotsRef: ShallowRef<Slots>,
  name: string | (() => string),
  props: Record<string, any>,
  parentComponent: VaporComponentInstance,
  fallback?: VaporSlot,
  once?: boolean,
  slotRoot?: boolean,
): VaporFragment {
  let suspense = currentParentSuspense || parentComponent.suspense
  const frag = createInteropFragment()
  // `isBlockValid` below reports VDOM-side validity (`contentState.valid`), not
  // `isValidBlock(frag.nodes)`: `frag.nodes` tracks the active fallback when one
  // is shown. (Optimism rationale: see createVNodeFragment.)
  let contentResolved = isHydrating

  let isMounted = false
  const contentState = {
    nodes: EMPTY_BLOCK as Block,
    valid: false,
    rendered: null as VNode | Block | null,
  }
  let currentParentNode: ParentNode | null = null
  let currentAnchor: Node | null = null
  let disposed = false
  const scope = effectScope()
  const slotBoundary = frag.slotBoundary
  let isContentUpdateRecheck = false
  let localFallback: BlockFn | undefined
  let slotResolutionState!: SlotResolutionState
  const cleanupInvalidContent = () => {
    if (currentParentNode) {
      removeAttachedNodes(contentState.nodes, currentParentNode)
    }
  }
  const onContentInvalid = [cleanupInvalidContent]
  frag.isBlockValid = componentAsValid => {
    if (!contentResolved) return true
    return slotResolutionState.activeFallback
      ? isValidBlock(slotResolutionState.activeFallback, componentAsValid)
      : contentState.valid
  }
  const boundary: SlotBoundaryContext = {
    get parent() {
      return slotBoundary
    },
    getFallback: (): BlockFn | undefined => localFallback,
    run: (fn, scope) => runWithRenderCtx(frag, fn, scope),
    markDirty: force => markSlotResolutionDirty(slotResolutionState, force),
    onContentInvalid,
  }
  slotResolutionState = {
    boundary,
    activeFallback: null,
    pendingRecheck: false,
    pendingRecheckForce: false,
    isRenderingFallback: false,
    getContent: () => contentState.nodes,
    getParentNode: () => currentParentNode,
    getAnchor: () => currentAnchor,
    isBusy: () => false,
    isDisposed: () => disposed,
    isContentValid: () => contentState.valid,
    syncNodes: () => {
      frag.nodes = slotResolutionState.activeFallback || contentState.nodes
    },
    notifyExposedValidityChange: () => {
      if (slotRoot && !isContentUpdateRecheck && slotBoundary) {
        slotBoundary.markDirty()
      }
    },
  }
  if (slotRoot) {
    trackSlotBoundaryDirtying(frag, cleanupInvalidContent)
  }
  localFallback = fallback
    ? once
      ? () => withOnceSlot(() => fallback(internals, parentComponent))
      : () => fallback(internals, parentComponent)
    : undefined

  const setRenderedContent = (
    rendered: VNode | Block | null,
    knownValid?: boolean,
  ): void => {
    contentState.rendered = rendered
    if (isVNode(rendered)) {
      contentState.nodes = resolveVNodeNodes(rendered)
      contentState.valid =
        knownValid === undefined ? hasValidVNodeContent(rendered) : knownValid
    } else if (rendered) {
      contentState.nodes = rendered
      contentState.valid =
        knownValid === undefined ? isValidSlot(rendered) : knownValid
    } else {
      contentState.nodes = EMPTY_BLOCK
      contentState.valid = false
    }
    contentResolved = true
  }

  const notifyUpdated = (): void => {
    syncInteropRoot(parentComponent)
    if (isMounted && frag.onUpdated) {
      frag.onUpdated.forEach(u => u())
    }
  }

  const notifyBeforeUpdate = (): void => {
    if (isMounted && frag.onBeforeUpdate) {
      frag.onBeforeUpdate.forEach(bu => bu())
    }
  }

  const recheckResolutionAfterContentUpdate = (
    forceResolutionRecheck = false,
  ): void => {
    isContentUpdateRecheck = true
    try {
      recheckSlotResolution(slotResolutionState, forceResolutionRecheck)
    } finally {
      isContentUpdateRecheck = false
    }
  }

  const finishContentUpdate = (forceResolutionRecheck = false): void => {
    recheckResolutionAfterContentUpdate(forceResolutionRecheck)
    notifyUpdated()
  }

  const removeRenderedContent = (
    rendered: VNode | Block,
    parentNode?: ParentNode,
  ): void => {
    const contentDetached = !!slotResolutionState.activeFallback
    // Active fallback means slot content was parked already; runtime-core
    // Fragment removal expects a still-attached sibling range.
    if (isVNode(rendered)) {
      internals.um(
        rendered,
        parentComponent as any,
        null,
        !contentDetached && !!parentNode,
      )
    } else {
      remove(rendered, contentDetached ? undefined : parentNode)
    }
  }

  frag.insert = (parentNode, anchor, parentSuspense) => {
    if (isHydrating) return
    if (parentSuspense !== undefined) suspense = parentSuspense
    currentParentNode = parentNode
    currentAnchor = anchor

    if (!isMounted) {
      scope.run(render)
      isMounted = true
    } else {
      if (isVNode(contentState.rendered)) {
        // move vdom content
        internals.m(
          contentState.rendered,
          parentNode,
          anchor,
          MoveType.REORDER,
          parentComponent as any,
          suspense,
        )
      } else if (contentState.rendered) {
        // move vapor content
        insert(contentState.rendered, parentNode, anchor, suspense)
      }

      insertActiveSlotFallback(slotResolutionState)
    }

    notifyUpdated()
  }

  frag.remove = parentNode => {
    if (parentNode) {
      currentParentNode = parentNode
    }
    scope.stop()
    disposed = true
    if (contentState.rendered) {
      removeRenderedContent(contentState.rendered, parentNode)
    }
    disposeSlotResolution(slotResolutionState)
  }

  const render = () => {
    const prev = currentInstance
    simpleSetCurrentInstance(frag.renderInstance)
    try {
      const renderSlotContent = () => {
        notifyBeforeUpdate()
        runWithFragmentCtxOnly(frag, () =>
          withSlotBoundary(boundary, () => {
            let slotContent: VNode | Block | undefined
            let slotContentValid = false

            if (slotsRef.value) {
              const renderContent = () =>
                renderSlot(
                  slotsRef.value,
                  isFunction(name) ? name() : name,
                  props,
                )
              slotContent = once ? withOnceSlot(renderContent) : renderContent()

              if (isVNode(slotContent)) {
                if (slotContent.type === Fragment) {
                  const children = slotContent.children as VNode[]
                  // Forwarded vapor slots need the slot outlet fallback chain
                  // even when the surrounding VDOM fragment stays otherwise
                  // valid, so preserve it on the forwarded branch itself.
                  ensureVaporSlotFallback(
                    children,
                    localFallback as () => VNodeArrayChildren,
                  )
                  slotContentValid = hasValidVNodeContent(slotContent)
                } else {
                  slotContentValid = true
                }
              } else if (slotContent) {
                slotContentValid = isValidSlot(slotContent)
              }
            }

            if (isHydrating) {
              // An empty VDOM slot fragment is still the hydration owner of the
              // SSR fragment markers when no fallback takes over. Keep hydrating
              // that content so later updates can patch inside the existing
              // range instead of mounting before it.
              const hydratedContent =
                slotContent && (slotContentValid || !hasSlotFallback(boundary))
                  ? slotContent
                  : undefined
              if (isVNode(hydratedContent)) {
                frag.vnode = hydratedContent
                frag.$key = getVNodeKey(hydratedContent)
                const refreshSlotVNode = () => {
                  frag.nodes = resolveVNodeNodes(hydratedContent)
                  notifyUpdated()
                }
                trackSlotVNodeUpdatesWithRefresh(
                  hydratedContent,
                  refreshSlotVNode,
                  notifyBeforeUpdate,
                )
                // Forwarded slot fragments that resolve to an empty SSR range
                // should stay on that range instead of re-entering it through
                // generic Fragment hydration.
                if (
                  !hydrateForwardedEmptySlotFragment(
                    hydratedContent,
                    parentComponent,
                    slotContentValid,
                  )
                ) {
                  hydrateVNode(hydratedContent, parentComponent as any)
                }
                // Remember the slot outlet insertion point outside the hydrated VNode range.
                // The hydrated content itself may be removed by later VDOM patches before the
                // fallback is inserted.
                const hydratedEnd = hydratedContent.anchor as Node
                currentParentNode = hydratedEnd.parentNode as ParentNode
                currentAnchor = hydratedEnd.nextSibling
                setRenderedContent(hydratedContent, slotContentValid)
              } else if (hydratedContent) {
                frag.vnode = null
                frag.$key = undefined
                setRenderedContent(hydratedContent as Block, slotContentValid)
              } else {
                frag.vnode = null
                frag.$key = undefined
                setRenderedContent(null)
              }
              finishContentUpdate(true)
              return
            }

            if (isVNode(slotContent)) {
              const prevRendered = contentState.rendered
              if (slotResolutionState.activeFallback && !slotContentValid) {
                // Re-run the slot only to refresh validity. While fallback is
                // active, a still-invalid VNode must stay out of the live DOM.
                if (prevRendered) {
                  removeRenderedContent(prevRendered, currentParentNode!)
                }
                frag.vnode = null
                frag.$key = undefined
                setRenderedContent(null)
                finishContentUpdate()
                return
              }
              frag.vnode = slotContent
              frag.$key = getVNodeKey(slotContent)
              const refreshSlotVNode = () => {
                const prevValid = contentState.valid
                const prevOutput = frag.nodes
                setRenderedContent(slotContent)
                recheckResolutionAfterContentUpdate()
                if (
                  contentState.valid !== prevValid ||
                  !isSameResolvedOutput(prevOutput, frag.nodes)
                ) {
                  notifyUpdated()
                }
              }
              trackSlotVNodeUpdatesWithRefresh(
                slotContent,
                refreshSlotVNode,
                notifyBeforeUpdate,
              )
              const prevIsVNode = isVNode(prevRendered)
              const prevVNode =
                prevIsVNode &&
                (!slotResolutionState.activeFallback || contentState.valid)
                  ? prevRendered
                  : null
              if (prevRendered && !prevIsVNode) {
                removeRenderedContent(prevRendered, currentParentNode!)
              }
              internals.p(
                prevVNode,
                slotContent,
                currentParentNode!,
                currentAnchor,
                parentComponent as any,
                suspense,
                undefined, // namespace
                slotContent.slotScopeIds, // pass slotScopeIds for :slotted styles
              )
              setRenderedContent(slotContent, slotContentValid)
              finishContentUpdate()
              return
            }

            if (slotContent) {
              frag.vnode = null
              frag.$key = undefined
              const prevRendered = contentState.rendered
              if (prevRendered) {
                removeRenderedContent(prevRendered, currentParentNode!)
              }
              insert(slotContent, currentParentNode!, currentAnchor)
              setRenderedContent(slotContent, slotContentValid)
              finishContentUpdate()
              return
            }

            if (contentState.rendered) {
              removeRenderedContent(contentState.rendered, currentParentNode!)
            }
            frag.vnode = null
            frag.$key = undefined
            setRenderedContent(null)
            finishContentUpdate()
          }),
        )
      }
      once ? renderSlotContent() : renderEffect(renderSlotContent)
    } finally {
      simpleSetCurrentInstance(prev)
    }
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    scope.run(render)
    if (!currentParentNode) {
      currentAnchor = getCurrentSlotEndAnchor() || currentHydrationNode
      currentParentNode = currentAnchor!.parentNode as ParentNode
    }
    isMounted = true
  }

  return frag
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
  registerTransitionInterop(
    getInteropTransitionType,
    getInteropTransitionElement,
  )
  setInteropEnabled()
  const internals = ensureRenderer().internals
  // Keep the shared base implementation immutable; renderer-bound methods must
  // be per-app so installing the plugin cannot overwrite another app's bridge.
  app._context.vapor = extend({}, vaporInteropImpl, {
    vdomMount: createVDOMComponent.bind(null, internals),
    vdomUnmount: internals.umt,
    vdomSlot: renderVDOMSlot.bind(null, internals),
    vdomMountVNode: mountVNode.bind(null, internals),
  })
  const mount = app.mount
  app.mount = ((...args) => {
    optimizePropertyLookup()
    return mount(...args)
  }) satisfies App['mount']
}

function hydrateVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
) {
  const node = currentHydrationNode!
  if (!vdomHydrateNode) vdomHydrateNode = ensureHydrationRenderer().hydrateNode!
  const nextNode = vdomHydrateNode(
    node,
    vnode,
    parentComponent,
    null,
    null,
    false,
  )
  if (nextNode) setCurrentHydrationNode(nextNode)
  else advanceHydrationNode(node)
}

function createFallback(
  fallback: InteropSlotFallback,
  parentComponent: ComponentInternalInstance | null,
  isVNodeFallback: () => boolean,
): BlockFn {
  const internals = ensureRenderer().internals
  return () => {
    if (isVNodeFallback()) {
      const frag = createVNodeChildrenFragment(
        internals,
        () => {
          const children = fallback()
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
    return fallback() as Block
  }
}

const renderEmptyVNodes = (): VNodeArrayChildren => EMPTY_VNODES

type InteropSlotFallback = {
  (): any
  __vdom?: boolean
}

interface InteropVaporSlotState {
  localFallback: ShallowRef<InteropSlotFallback | undefined>
  outletFallback: ShallowRef<InteropSlotFallback | undefined>
}

function resolveInteropVaporSlotState(vnode: VNode): InteropVaporSlotState {
  const slot = vnode.vs!
  let state = slot.state as InteropVaporSlotState | undefined
  if (!state) {
    state = {
      localFallback: shallowRef(slot.fallback),
      outletFallback: shallowRef(slot.outletFallback),
    }
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
  prevState.localFallback.value = n2.vs!.fallback
  prevState.outletFallback.value = n2.vs!.outletFallback
}

function trackInteropFallbackChanges(
  scope: ReturnType<typeof effectScope> | undefined,
  state: InteropVaporSlotState,
  onChange: () => void,
): void {
  if (!scope) return
  let trackedLocalFallback: InteropSlotFallback | undefined
  let trackedOutletFallback: InteropSlotFallback | undefined
  let initialized = false
  scope.run(() => {
    renderEffect(() => {
      const nextLocalFallback = state.localFallback.value
      const nextOutletFallback = state.outletFallback.value
      if (!initialized) {
        trackedLocalFallback = nextLocalFallback
        trackedOutletFallback = nextOutletFallback
        initialized = true
        return
      }
      if (
        trackedLocalFallback === nextLocalFallback &&
        trackedOutletFallback === nextOutletFallback
      ) {
        return
      }
      trackedLocalFallback = nextLocalFallback
      trackedOutletFallback = nextOutletFallback
      onChange()
    }, true)
  })
}

function renderVaporSlot(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
): Block {
  const prev = currentInstance
  let prevSuspense: SuspenseBoundary | null = null
  simpleSetCurrentInstance(parentComponent)
  if (__FEATURE_SUSPENSE__ && isSuspenseEnabled && parentSuspense) {
    prevSuspense = setParentSuspense(parentSuspense)
  }
  try {
    if (!vnode.vs || !vnode.vs.slot) {
      return EMPTY_BLOCK
    }
    const slotState = resolveInteropVaporSlotState(vnode)
    const scopeIds = getInteropVaporSlotScopeIds(vnode, parentComponent)
    // Most of the interop setup is shared, but slots that start with a local
    // VDOM fallback still need to let an inner SlotFragment own the active
    // fallback lifecycle. Forcing the interop wrapper to own that branch breaks
    // fallback blocks that can later resolve to an empty vnode list.
    const frag = createInteropFragment()
    // Optimistic until content resolves into `frag.nodes`; see createVNodeFragment.
    let contentResolved = isHydrating
    frag.isBlockValid = componentAsValid =>
      contentResolved ? isValidBlock(frag.nodes, componentAsValid) : true
    const slotBoundary = frag.slotBoundary
    let contentNodes: Block = EMPTY_BLOCK
    let isResolvingContent = false
    let localFallback!: BlockFn
    let outletFallback!: BlockFn
    let currentParentNode: ParentNode | null = null
    let currentAnchor: Node | null = null
    let slotScope: ReturnType<typeof effectScope> | undefined
    let disposed = false
    let slotResolutionState!: SlotResolutionState
    let ownedSlotFragment: SlotFragment | undefined
    let ownedSlotFragmentDirtyQueued = false
    let ownedSlotFragmentDirtyForce = false
    const onContentInvalid = [
      () => {
        if (currentParentNode) {
          removeAttachedNodes(contentNodes, currentParentNode)
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
    const outletFallbackBoundary: SlotBoundaryContext = {
      get parent() {
        return slotBoundary
      },
      getFallback: () =>
        slotState.outletFallback.value ? outletFallback : undefined,
      run: (fn, scope) => runWithRenderCtx(frag, fn, scope),
      markDirty: markInteropSlotResolutionDirty,
    }
    const localFallbackBoundary: SlotBoundaryContext = {
      get parent() {
        return outletFallbackBoundary
      },
      getFallback: () =>
        slotState.localFallback.value ? localFallback : undefined,
      run: (fn, scope) => runWithRenderCtx(frag, fn, scope),
      markDirty: markInteropSlotResolutionDirty,
      onContentInvalid,
    }
    slotResolutionState = {
      boundary: localFallbackBoundary,
      activeFallback: null,
      pendingRecheck: false,
      pendingRecheckForce: false,
      isRenderingFallback: false,
      getContent: () => contentNodes,
      getParentNode: () => currentParentNode,
      getAnchor: () => currentAnchor,
      isBusy: () => isResolvingContent,
      isDisposed: () => disposed,
      isContentValid: () => isValidSlot(contentNodes),
      syncNodes: () => {
        frag.nodes = slotResolutionState.activeFallback || contentNodes
        contentResolved = true
      },
      notifyExposedValidityChange: () => {
        if (slotBoundary) {
          slotBoundary.markDirty()
        }
      },
    }
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
      disposeSlotResolution(slotResolutionState)
      slotScope = undefined
      currentParentNode = null
      currentAnchor = null
    }

    try {
      localFallback = createFallback(
        () => (slotState.localFallback.value || renderEmptyVNodes)(),
        parentComponent,
        () =>
          !!slotState.localFallback.value &&
          !!slotState.localFallback.value.__vdom,
      )
      outletFallback = createFallback(
        () => (slotState.outletFallback.value || renderEmptyVNodes)(),
        parentComponent,
        () =>
          !!slotState.outletFallback.value &&
          !!slotState.outletFallback.value.__vdom,
      )
      const hasInteropFallback =
        !!slotState.localFallback.value || !!slotState.outletFallback.value
      slotResolutionState.pendingRecheck = false
      slotResolutionState.pendingRecheckForce = false
      let finish: ((contentValid: boolean) => void) | undefined
      const finishHydratingContent = (contentValid: boolean): void => {
        if (!finish) return
        finish(contentValid)
        finish = undefined
      }
      const finalizeResolvedContent = (
        resolvedContent: Block | undefined,
      ): Block | undefined => {
        if (resolvedContent && scopeIds) {
          setScopeId(resolvedContent, scopeIds)
        }
        if (hasInteropFallback && isSlotFragment(resolvedContent)) {
          finishHydratingContent(true)
          return resolvedContent
        }
        contentNodes = resolvedContent || EMPTY_BLOCK
        finishHydratingContent(isValidSlot(contentNodes))
        recheckSlotResolution(slotResolutionState, takePendingRecheck())
        return resolvedContent
      }
      let resolvedContent: Block | undefined
      isResolvingContent = true
      try {
        if (isHydrating) {
          resolvedContent = withHydratingSlotBoundary(() => {
            // SSR may currently contain fallback DOM. Delay empty content
            // anchors until rendered content proves whether it should win.
            if (hasSlotFallback(localFallbackBoundary)) {
              finish = startPendingSlotContent(currentHydrationNode)
            }
            try {
              return finalizeResolvedContent(
                runWithFragmentCtxOnly(frag, () => {
                  const renderSlot = () =>
                    withSlotBoundary(localFallbackBoundary, () =>
                      invokeVaporSlot(vnode),
                    )
                  return renderSlot()
                }),
              )
            } finally {
              finishHydratingContent(true)
            }
          })
        } else {
          resolvedContent = finalizeResolvedContent(
            runWithFragmentCtxOnly(frag, () =>
              withSlotBoundary(localFallbackBoundary, () =>
                invokeVaporSlot(vnode),
              ),
            ),
          )
        }
      } finally {
        isResolvingContent = false
      }
      const nextScope = vnode.vs!.scope
      if (nextScope && slotScope !== nextScope && !disposed) {
        slotScope = nextScope
        nextScope.run(() => {
          onScopeDispose(() => dispose(), true)
        })
      }
      if (hasInteropFallback && isSlotFragment(resolvedContent)) {
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
      dispose()
      stopVaporSlotScope(vnode)
      throw e
    }
  } finally {
    if (__FEATURE_SUSPENSE__ && isSuspenseEnabled && parentSuspense) {
      setParentSuspense(prevSuspense)
    }
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
    return scope.run(() =>
      vnode.vs!.slot(new Proxy(propsRef, vaporSlotPropsProxyHandler)),
    )!
  } catch (e) {
    vnode.vs!.scope = undefined
    scope.stop()
    throw e
  }
}

function syncVNodeEl(vnode: VNode, instance: VaporComponentInstance): void {
  const rootEl = getRootElement(instance)
  if (rootEl) {
    vnode.el = rootEl
  } else {
    vnode.el = vnode.anchor
    vnode.dirs = null
  }
}

function syncInteropRoot(instance: VaporComponentInstance): void {
  const state = vnodeHookStateMap.get(instance)
  if (!state) return
  syncVNodeEl(state.vnode, instance)
  const hooks = state.postRootSyncHooks
  for (let i = 0; i < hooks.length; i++) {
    hooks[i](state.vnode)
  }
}

interface VNodeHookState {
  vnode: VNode
  skipVnodeHooks: boolean
  postRootSyncHooks: ((vnode: VNode) => void)[]
}

const vnodeHookStateMap = new WeakMap<VaporComponentInstance, VNodeHookState>()

function ensureVNodeHookState(
  instance: VaporComponentInstance,
  vnode: VNode,
): VNodeHookState {
  let state = vnodeHookStateMap.get(instance)
  if (!state) {
    state = {
      vnode,
      skipVnodeHooks: false,
      postRootSyncHooks: [],
    }
    vnodeHookStateMap.set(instance, state)
    ;(instance.bu ||= []).push(() => {
      if (state!.skipVnodeHooks) return
      const vnodeHook =
        state!.vnode.props && state!.vnode.props.onVnodeBeforeUpdate
      if (vnodeHook) {
        callWithAsyncErrorHandling(
          vnodeHook,
          instance.parent,
          ErrorCodes.VNODE_HOOK,
          [state!.vnode, state!.vnode],
        )
      }
    })

    // Sync the outer component vnode before running any updated hooks. Hooks
    // that depend on the latest root, like scoped CSS interop, run immediately
    // after the sync and before component updated hooks / onVnodeUpdated.
    ;(instance.u ||= []).unshift(() => syncInteropRoot(instance))
    instance.u.push(() => {
      if (state!.skipVnodeHooks) {
        state!.skipVnodeHooks = false
        return
      }
      const vnodeHook = state!.vnode.props && state!.vnode.props.onVnodeUpdated
      if (vnodeHook) {
        callWithAsyncErrorHandling(
          vnodeHook,
          instance.parent,
          ErrorCodes.VNODE_HOOK,
          [state!.vnode, state!.vnode],
        )
      }
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
    currentParentSuspense || (parentComponent && parentComponent.suspense)
  const frag = createInteropFragment()
  let contentValid = false
  // `isBlockValid` reports `contentValid` (VDOM-side `ensureValidVNode`), not
  // `isValidBlock(frag.nodes)`. (Optimism rationale: see createVNodeFragment.)
  let contentResolved = isHydrating
  frag.isBlockValid = () => (contentResolved ? contentValid : true)
  let currentVNode: VNode | null = null
  let currentChildren: VNode[] = EMPTY_VNODES
  let currentParentNode: ParentNode | null = null
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
    const prevValid = contentResolved ? contentValid : true
    contentValid = !!ensureValidVNode(children)
    if (children.length === 0) {
      frag.nodes = EMPTY_BLOCK
    } else if (children.length === 1) {
      frag.nodes = resolveVNodeNodes(children[0])
    } else {
      frag.nodes = children.map(resolveVNodeNodes) as Block[]
    }
    contentResolved = true
    return prevValid !== contentValid
  }
  const syncResolvedNodesAndCleanup = (
    children: VNode[] = currentChildren,
  ): boolean => {
    const validityChanged = syncResolvedNodes(children)
    if (!contentValid && frag.slotBoundary) {
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
    if (isMounted && frag.onUpdated) {
      frag.onUpdated.forEach(hook => hook())
    }
  }
  const notifyBeforeUpdate = (): void => {
    if (isMounted && frag.onBeforeUpdate) {
      frag.onBeforeUpdate.forEach(hook => hook())
    }
  }

  const renderContent = () => {
    const prev = currentInstance
    simpleSetCurrentInstance(parentComponent)
    try {
      renderEffect(() => {
        runWithFragmentCtxOnly(frag, () => {
          const nextChildren = render()
          notifyBeforeUpdate()
          if (isHydrating) {
            nextChildren.forEach(vnode => hydrateVNode(vnode, parentComponent))
            currentChildren = nextChildren
            currentVNode = createVNode(Fragment, null, nextChildren)
            currentParentNode = currentHydrationNode!.parentNode as ParentNode
            currentAnchor = currentHydrationNode
            // Slot fallback hydration can leave an inner empty-branch anchor
            // immediately before the enclosing slot end anchor. Fragment
            // patching needs the boundary insertion point after that local
            // anchor; otherwise later fallback siblings patch in front of it.
            if (
              frag.slotBoundary &&
              currentAnchor &&
              isHydrationAnchor(currentAnchor) &&
              currentAnchor !== getCurrentSlotEndAnchor() &&
              currentAnchor.nextSibling
            ) {
              currentAnchor = currentAnchor.nextSibling
            }
          } else if (!isMounted) {
            currentChildren = nextChildren
            currentVNode = createVNode(Fragment, null, nextChildren)
            const wasResolved = contentResolved
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
                undefined,
                null,
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
              undefined,
              null,
              false,
            )
            currentChildren = nextChildren
            currentVNode = nextVNode
          }

          const validityChanged = syncResolvedNodesAndCleanup()
          if (isHydrating) {
            if (isMounted && frag.onUpdated) {
              frag.onUpdated.forEach(hook => hook())
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

  frag.insert = (parentNode, anchor, parentSuspense) => {
    if (isHydrating) return
    if (parentSuspense !== undefined) suspense = parentSuspense
    currentParentNode = parentNode
    currentAnchor = anchor
    if (!isMounted) {
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
          undefined,
          null,
          false,
        )
      }
      syncResolvedNodes()
      isMounted = true
    } else {
      currentChildren.forEach(vnode => {
        internals.m(
          vnode,
          parentNode,
          anchor,
          MoveType.REORDER,
          parentComponent as any,
          suspense,
        )
      })
    }
  }

  frag.remove = parentNode => {
    scope.stop()
    currentChildren.forEach(vnode => {
      internals.um(vnode, parentComponent, null, !!parentNode)
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
  if (rawSlots == null) return rawSlots
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
        (slot as any).__vapor || (slot as any).__vs || (slot as any)._n
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
  // `_` keeps direct <slot> outlets on the VDOM slot path; `$` exposes live
  // slot keys to Vapor useSlots() / dynamic forwarding.
  const rawSlots = {
    $: [new Proxy(slotsRef, interopSlotsSourceHandlers)],
  } as any
  Object.defineProperty(rawSlots, '_', {
    value: slotsRef, // pass the slots ref
    configurable: true,
  })
  return rawSlots as RawSlots
}

const interopScopeIdRootMap = new WeakMap<VaporComponentInstance, Element>()
const interopScopeIdFragmentMap = new WeakMap<
  DynamicFragment,
  VaporComponentInstance
>()

function trackInteropScopeIdFragment(
  instance: VaporComponentInstance,
  frag: DynamicFragment,
): void {
  if (interopScopeIdFragmentMap.get(frag) === instance) return
  interopScopeIdFragmentMap.set(frag, instance)
  ;(frag.onUpdated ||= []).push(() => syncInteropRoot(instance))
}

function setInteropVnodeScopeId(
  instance: VaporComponentInstance,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): void {
  const root = getRootElement(instance, frag =>
    trackInteropScopeIdFragment(instance, frag),
  )
  if (!root) {
    interopScopeIdRootMap.delete(instance)
    return
  }
  // VDOM applies scope ids when an element is mounted, not on same-root patch.
  if (interopScopeIdRootMap.get(instance) === root) return
  interopScopeIdRootMap.set(instance, root)

  const scopeIds = getInteropVnodeScopeIds(vnode, parentComponent)
  if (!scopeIds) return

  for (let i = 0; i < scopeIds.length; i++) {
    root.setAttribute(scopeIds[i], '')
  }
}

function getInteropVnodeScopeIds(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): string[] | undefined {
  const scopeIds: string[] = []
  if (vnode.scopeId) scopeIds.push(vnode.scopeId)
  if (vnode.slotScopeIds) scopeIds.push(...vnode.slotScopeIds)
  scopeIds.push(...getInheritedScopeIds(vnode, parentComponent))
  return scopeIds.length ? scopeIds : undefined
}

function getInteropVaporSlotScopeIds(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): string[] | undefined {
  const scopeIds: string[] = []
  if (vnode.slotScopeIds) scopeIds.push(...vnode.slotScopeIds)
  scopeIds.push(...getInheritedScopeIds(vnode, parentComponent))
  return scopeIds.length ? scopeIds : undefined
}

function createInteropFragment(
  nodes: Block = EMPTY_BLOCK,
  vnode: VNode | null = null,
): RenderContextFragment<Block> {
  const frag = new RenderContextFragment<Block>(nodes)
  frag.vnode = vnode
  return frag
}
