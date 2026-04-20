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
  invokeDirectiveHook,
  isEmitListener,
  isKeepAlive,
  isVNode,
  isHydrating as isVdomHydrating,
  normalizeRef,
  normalizeVNode,
  onScopeDispose,
  queuePostFlushCb,
  renderSlot,
  setTransitionHooks as setVNodeTransitionHooks,
  shallowReactive,
  shallowRef,
  shouldUpdateComponent,
  simpleSetCurrentInstance,
  activate as vdomActivate,
  deactivate as vdomDeactivate,
  setRef as vdomSetRef,
  warn,
} from '@vue/runtime-dom'
import { effectScope } from '@vue/reactivity'
import {
  type LooseRawProps,
  type LooseRawSlots,
  type VaporComponent,
  VaporComponentInstance,
  createComponent,
  getCurrentScopeId,
  getRootElement,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import {
  type Block,
  type BlockFn,
  type VaporTransitionHooks,
  insert,
  isValidBlock,
  move,
  remove,
} from './block'
import {
  EMPTY_OBJ,
  NOOP,
  ShapeFlags,
  extend,
  isArray,
  isFunction,
  isReservedProp,
} from '@vue/shared'
import { type RawProps, rawPropsProxyHandlers } from './componentProps'
import type { RawSlots, VaporSlot } from './componentSlots'
import { currentSlotScopeIds, setCurrentSlotOwner } from './componentSlots'
import { renderEffect } from './renderEffect'
import { _next, createTextNode } from './dom/node'
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
  SlotFallbackController,
  SlotFragment,
  VaporFragment,
  findFirstSlotFallbackCarrierNode,
  getCurrentSlotEndAnchor,
  insertSlotFallbackCarrier,
  isFragment,
  removeSlotFallbackCarrier,
  resolveSlotFallbackCarrierOwner,
  trackSlotBoundaryDirtying,
  withHydratingSlotBoundary,
  withHydratingSlotFallbackActive,
  withOwnedSlotBoundary,
} from './fragment'
import type { NodeRef } from './apiTemplateRef'
import {
  getVNodeKey,
  setTransitionHooks as setVaporTransitionHooks,
} from './components/Transition'
import { setInteropEnabled } from './vdomInteropState'
import {
  type KeepAliveInstance,
  activate,
  currentKeepAliveCtx,
  deactivate,
  setCurrentKeepAliveCtx,
} from './components/KeepAlive'
import {
  parentSuspense as currentParentSuspense,
  setParentSuspense,
} from './components/Suspense'

export const interopKey: unique symbol = Symbol(`interop`)

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
    let selfAnchor = (vnode.anchor = createTextNode())
    if (isHydrating) {
      // avoid vdom hydration children mismatch by the selfAnchor, delay its insertion
      queuePostFlushCb(() => container.insertBefore(selfAnchor, anchor))
    } else {
      vnode.el = selfAnchor
      container.insertBefore(selfAnchor, anchor)
    }
    const prev = currentInstance
    simpleSetCurrentInstance(parentComponent)

    const propsRef = shallowRef(filterReservedProps(vnode.props))
    const slotsRef = shallowRef(vnode.children)

    let prevSuspense: SuspenseBoundary | null = null
    if (__FEATURE_SUSPENSE__ && parentSuspense) {
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
      {
        _: slotsRef, // pass the slots ref
      } as any as RawSlots,
      undefined,
      undefined,
      (parentComponent ? parentComponent.appContext : vnode.appContext) as any,
      // VDOM interop owns the explicit mount below
      true,
    ))
    instance.rawPropsRef = propsRef
    instance.rawSlotsRef = slotsRef
    ensureVNodeHookState(instance, vnode)

    // copy the shape flag from the vdom component if inside a keep-alive
    if (parentComponent && isKeepAlive(parentComponent))
      instance.shapeFlag = vnode.shapeFlag

    if (vnode.transition) {
      setVaporTransitionHooks(
        instance,
        vnode.transition as VaporTransitionHooks,
      )
    }

    if (__FEATURE_SUSPENSE__ && parentSuspense) {
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
      instance.rawPropsRef!.value = filterReservedProps(n2.props)
      instance.rawSlotsRef!.value = n2.children
      queuePostFlushCb(() => {
        syncVNodeEl(n2, instance)
        if (!instance.isUpdating) {
          vnodeHookState.skipVnodeHooks = false
        }
      })
    }
  },

  unmount(vnode, doRemove) {
    const container = doRemove ? vnode.anchor!.parentNode : undefined
    const instance = vnode.component as any as VaporComponentInstance
    if (instance) {
      // the async component may not be resolved yet, block is null
      if (instance.block) {
        unmountComponent(instance, container)
        if (!doRemove) {
          // When the surrounding VDOM fragment owns DOM removal, we still need
          // to dispose the vapor-returned block tree so nested interop state
          // (for example forwarded VDOM slots) does not stay subscribed.
          remove(instance.block, undefined)
        }
      }
    } else if (vnode.vb) {
      remove(vnode.vb, container)
      stopVaporSlotScope(vnode)
    }
    if (doRemove) {
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
      insert((n2.vb = slotBlock), container, selfAnchor)
    } else {
      // update
      // slot function changed (e.g. dynamic slots from _createForSlots),
      // need to re-mount the vapor block
      if (n2.vs!.slot !== n1.vs!.slot) {
        const selfAnchor = n1.anchor as Node
        const parent = selfAnchor.parentNode as ParentNode
        const nextSibling = selfAnchor.nextSibling
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
        insert((n2.el = n2.anchor = newAnchor), parent, insertAnchor)
        insert((n2.vb = slotBlock), parent, newAnchor)
      } else {
        n2.el = n2.anchor = n1.anchor
        n2.vb = n1.vb
        ;(n2.vs!.ref = n1.vs!.ref)!.value = n2.props
        n2.vs!.scope = n1.vs!.scope
        syncInteropVaporSlotState(n1, n2)
      }
    }
  },

  move(vnode, container, anchor, moveType) {
    move(vnode.vb || (vnode.component as any), container, anchor, moveType)
    move(vnode.anchor as any, container, anchor, moveType)
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
    // Check both vapor's isHydrating (for createVaporSSRApp) and
    // VDOM's isVdomHydrating (for createSSRApp).
    // In CSR (createApp/createVaporApp + vaporInteropPlugin), both are false,
    // so this logic is tree-shaken.
    if (!isHydrating && !isVdomHydrating) return node
    vaporHydrateNode(node, () =>
      this.mount(
        vnode,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        onBeforeMount,
        onVnodeBeforeMount,
      ),
    )
    return _next(node)
  },

  hydrateSlot(vnode, node, parentComponent, parentSuspense) {
    if (!isHydrating && !isVdomHydrating) return node
    vaporHydrateNode(node, () => {
      vnode.vb = renderVaporSlot(vnode, parentComponent, parentSuspense)
      vnode.anchor = vnode.el =
        isFragment(vnode.vb) && vnode.vb.anchor
          ? vnode.vb.anchor
          : currentHydrationNode!

      if (__DEV__ && !vnode.anchor) {
        throw new Error(
          `Failed to locate slot anchor. this is likely a Vue internal bug.`,
        )
      }
    })
    // For fragment-wrapped slot content (`<!--[-->...<!--]-->`), return the
    // node after the end anchor to avoid hydrateChildren() treating `<!--]-->`
    // as an extra child of the current container.
    return isComment(node, '[')
      ? (vnode.anchor as Node).nextSibling
      : (vnode.anchor as Node)
  },

  setTransitionHooks(component, hooks) {
    setVaporTransitionHooks(component as any, hooks as VaporTransitionHooks)
  },

  activate(vnode, container, anchor, parentComponent) {
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
      instance.rawSlotsRef!.value = vnode.children
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
        if (!instance.isUpdating) {
          vnodeHookState.skipVnodeHooks = false
        }
      })
    }
    activate(instance, container, anchor)
    insert(vnode.anchor as any, container, anchor)
    const vnodeMountedHook = vnode.props && vnode.props.onVnodeMounted
    if (vnodeMountedHook) {
      queuePostFlushCb(() => {
        callWithAsyncErrorHandling(
          vnodeMountedHook,
          parentComponent,
          ErrorCodes.VNODE_HOOK,
          [vnode],
        )
      })
    }
  },

  deactivate(vnode, container) {
    const instance = vnode.component as any as VaporComponentInstance
    deactivate(instance, container)
    insert(vnode.anchor as any, container)
    queuePostFlushCb(() => {
      const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted
      if (vnodeHook) {
        callWithAsyncErrorHandling(
          vnodeHook,
          instance.parent,
          ErrorCodes.VNODE_HOOK,
          [vnode],
        )
      }
    })
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
    const slot = target[key]
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
}

let vdomHydrateNode: HydrationRenderer['hydrateNode'] | undefined

// Static/Fragment vnodes always represent a contiguous range [el..anchor].
// For component vnodes, only treat them as a range when their hydrated subTree
// is Static/Fragment (multi-root component case).
function resolveVNodeRange(vnode: VNode): [Node, Node] | undefined {
  const { type, shapeFlag, el, anchor } = vnode
  if (shapeFlag & ShapeFlags.TELEPORT && el && anchor && anchor !== el) {
    return [el as Node, anchor as Node]
  }

  if ((type === Static || type === Fragment) && el && anchor && anchor !== el) {
    return [el as Node, anchor as Node]
  }
  if (!(shapeFlag & ShapeFlags.COMPONENT)) {
    return
  }

  const subTree = vnode.component && vnode.component.subTree
  const subEl = subTree && subTree.el
  const subAnchor = subTree && subTree.anchor
  if (
    subTree &&
    (subTree.type === Static || subTree.type === Fragment) &&
    subEl &&
    subAnchor &&
    subAnchor !== subEl
  ) {
    return [subEl as Node, subAnchor as Node]
  }
}

function resolveVNodeNodes(vnode: VNode): Block {
  // Vapor component VNodes expose only their first root on `vnode.el`.
  // Use the mounted block so multi-root output keeps slot carriers and other
  // trailing anchors in the resolved block shape.
  if (!isHydrating && vnode.component && isVaporComponent(vnode.component)) {
    const block = (vnode.component as any).block as Block | undefined
    if (block) {
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
  return vnode.el as Block
}

function appendVnodeUpdatedHook(vnode: VNode, hook: () => void): void {
  const props = (vnode.props ||= {})
  const existing = props.onVnodeUpdated
  props.onVnodeUpdated = existing
    ? isArray(existing)
      ? [...existing, hook]
      : [existing, hook]
    : hook
}

function trackFragmentVNodeUpdates(frag: VaporFragment, vnode: VNode): void {
  const refresh = () => {
    frag.nodes = resolveVNodeNodes(vnode)
    frag.validityPending = false
    if (frag.onUpdated) frag.onUpdated.forEach(m => m())
  }
  appendVnodeUpdatedHook(vnode, refresh)
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
  const frag = new VaporFragment<Block>([])
  frag.validityPending = !isHydrating
  frag.vnode = vnode
  frag.$key = vnode.key
  trackFragmentVNodeUpdates(frag, vnode)

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
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    hydrateVNode(vnode, parentComponent as any)
    onScopeDispose(unmount, true)
    isMounted = true
    frag.nodes = resolveVNodeNodes(vnode)
    frag.validityPending = false
  }

  frag.insert = (parentNode, anchor, transition) => {
    if (isHydrating) return
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      if ((vnode.type as any).__vapor) {
        activate(vnode.component as any, parentNode, anchor)
      } else {
        vdomActivate(
          vnode,
          parentNode,
          anchor,
          internals,
          parentComponent as any,
          null,
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
          suspense,
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
        )
      }
      simpleSetCurrentInstance(prev)
    }
    frag.nodes = resolveVNodeNodes(vnode)
    frag.validityPending = false
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
): VaporFragment {
  const suspense =
    currentParentSuspense || (parentComponent && parentComponent.suspense)
  const useBridge = shouldUseRendererBridge(component)
  const comp = useBridge ? ensureRendererBridge(component) : component
  const frag = new VaporFragment<Block>([])
  frag.validityPending = !isHydrating
  const vnode = (frag.vnode = createVNode(
    comp,
    rawProps && extend({}, new Proxy(rawProps, rawPropsProxyHandlers)),
  ))
  frag.$key = vnode.key
  trackFragmentVNodeUpdates(frag, vnode)

  if (currentKeepAliveCtx) {
    currentKeepAliveCtx.processShapeFlag(frag)
    // for VDOM async components, trigger cacheBlock after resolution
    if ((component as any).__asyncLoader) {
      const keepAliveCtx = currentKeepAliveCtx
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
    setCurrentKeepAliveCtx(null)
  }

  const wrapper = new VaporComponentInstance<Record<string, unknown>>(
    useBridge ? (comp as any) : { props: component.props },
    rawProps as RawProps,
    rawSlots as RawSlots,
    parentComponent ? parentComponent.appContext : undefined,
    undefined,
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
      wrapper.slots === EMPTY_OBJ
        ? EMPTY_OBJ
        : new Proxy(wrapper.slots, vaporSlotsProxyHandler)
  }

  let rawRef: VNodeNormalizedRef | null = null
  let isMounted = false
  const unmount = (parentNode?: ParentNode, transition?: TransitionHooks) => {
    // unset ref
    if (rawRef) vdomSetRef(rawRef, null, null, vnode, true)
    if (transition) setVNodeTransitionHooks(vnode, transition)
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      vdomDeactivate(
        vnode,
        (parentComponent as KeepAliveInstance)!.ctx.getStorageContainer(),
        internals,
        parentComponent as any,
        null,
      )
      return
    }
    internals.umt(vnode.component!, null, !!parentNode)
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    hydrateVNode(vnode, parentComponent as any)
    onScopeDispose(unmount, true)
    isMounted = true
    frag.nodes = resolveVNodeNodes(vnode)
    frag.validityPending = false
  }

  vnode.scopeId = getCurrentScopeId() || null
  vnode.slotScopeIds = currentSlotScopeIds

  frag.insert = (parentNode, anchor, transition) => {
    if (isHydrating) return
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      vdomActivate(
        vnode,
        parentNode,
        anchor,
        internals,
        parentComponent as any,
        null,
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
          suspense,
          undefined,
          false,
        )
        // set ref
        if (rawRef) vdomSetRef(rawRef, null, null, vnode)
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
        )
      }
      simpleSetCurrentInstance(prev)
    }

    frag.nodes = resolveVNodeNodes(vnode)
    frag.validityPending = false
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

function trackSlotVNodeUpdates(frag: VaporFragment, vnode: VNode): void {
  trackSlotVNodeUpdatesWithRefresh(vnode, () => {
    frag.nodes = resolveVNodeNodes(vnode)
    if (frag.onUpdated) frag.onUpdated.forEach(m => m())
  })
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
  const contentValid = hasValidVNodeContent(vnode)
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
): void {
  const onUpdated = () => refresh()

  const track = (node: VNode) => {
    appendVnodeUpdatedHook(node, onUpdated)
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
): VaporFragment {
  const suspense = currentParentSuspense || parentComponent.suspense
  const frag = new VaporFragment<Block>([])
  trackSlotBoundaryDirtying(frag)
  frag.validityPending = !isHydrating
  const instance = currentInstance

  let isMounted = false
  const contentState = {
    nodes: [] as Block,
    valid: false,
    rendered: null as VNode | Block | null,
  }
  let currentParentNode: ParentNode | undefined
  let currentAnchor: Node | null | undefined
  let disposed = false
  const scope = effectScope()
  const inheritedBoundary = frag.inheritedSlotBoundary
  const controller: SlotFallbackController = new SlotFallbackController({
    getParentBoundary: () => inheritedBoundary,
    getLocalFallback: (): BlockFn | undefined => wrappedLocalFallback,
    getContent: () => contentState.nodes,
    getParentNode: () => {
      if (currentParentNode) {
        return currentParentNode
      }
      const carrierAnchor = findFirstSlotFallbackCarrierNode(contentState.nodes)
      return carrierAnchor
        ? (carrierAnchor.parentNode as ParentNode | null)
        : null
    },
    getAnchor: () => currentAnchor || null,
    isContentValid: () => contentState.valid,
    runWithRenderCtx: fn => runWithFragmentRenderCtx(frag, fn),
    isDisposed: () => disposed,
    onValidityChange: () => {
      if (frag.inheritedSlotBoundary) {
        frag.inheritedSlotBoundary.markDirty()
      }
    },
  })
  const wrappedLocalFallback: BlockFn | undefined = fallback
    ? controller.wrapFallback(() => fallback(internals, parentComponent))
    : undefined

  const updateNodes = (): void => {
    frag.nodes = controller.getEffectiveOutput()
  }

  const setRenderedContent = (rendered: VNode | Block | null): void => {
    contentState.rendered = rendered
    if (isVNode(rendered)) {
      contentState.nodes = resolveVNodeNodes(rendered)
      contentState.valid = hasValidVNodeContent(rendered)
    } else if (rendered) {
      contentState.nodes = rendered
      contentState.valid = isValidBlock(rendered)
    } else {
      contentState.nodes = []
      contentState.valid = false
    }
    frag.validityPending = false
  }

  const notifyUpdated = (): void => {
    if (isMounted && frag.onUpdated) frag.onUpdated.forEach(m => m())
  }

  const finishContentUpdate = (forceFallbackRecheck = false): void => {
    controller.recheck(forceFallbackRecheck)
    updateNodes()
    notifyUpdated()
  }

  frag.insert = (parentNode, anchor) => {
    if (isHydrating) return
    currentParentNode = parentNode || undefined
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
        )
      } else if (contentState.rendered) {
        // move vapor content
        insert(contentState.rendered, parentNode, anchor)
      }

      controller.relocate()
    }

    notifyUpdated()
  }

  frag.remove = parentNode => {
    currentParentNode = parentNode || currentParentNode || undefined
    currentAnchor = currentAnchor || null
    scope.stop()
    disposed = true
    if (isVNode(contentState.rendered)) {
      // When the surrounding VDOM range already owns DOM removal, unmount the
      // vnode state only and avoid tearing down the same hydrated range twice.
      internals.um(
        contentState.rendered,
        parentComponent as any,
        null,
        !!parentNode,
      )
    } else if (contentState.rendered) {
      remove(contentState.rendered, parentNode)
    }
    controller.dispose()
  }

  const render = () => {
    const prev = currentInstance
    simpleSetCurrentInstance(instance)
    try {
      renderEffect(() => {
        runWithFragmentRenderCtx(frag, () =>
          withOwnedSlotBoundary(controller.boundary, () => {
            let slotContent: VNode | Block | undefined
            let slotContentValid = false

            if (slotsRef.value) {
              slotContent = renderSlot(
                slotsRef.value,
                isFunction(name) ? name() : name,
                props,
              )

              if (isVNode(slotContent)) {
                if (slotContent.type === Fragment) {
                  const children = slotContent.children as VNode[]
                  // Forwarded vapor slots need the slot outlet fallback chain
                  // even when the surrounding VDOM fragment stays otherwise
                  // valid, so preserve it on the forwarded branch itself.
                  ensureVaporSlotFallback(
                    children,
                    wrappedLocalFallback as () => VNodeArrayChildren,
                  )
                  slotContentValid = hasValidVNodeContent(slotContent)
                } else {
                  slotContentValid = true
                }
              } else if (slotContent) {
                slotContentValid = isValidBlock(slotContent)
              }
            }

            if (isHydrating) {
              // An empty VDOM slot fragment is still the hydration owner of the
              // SSR fragment markers when no fallback takes over. Keep hydrating
              // that content so later updates can patch inside the existing
              // range instead of mounting before it.
              const hydratedContent =
                slotContent && (slotContentValid || !controller.hasFallback())
                  ? slotContent
                  : undefined
              if (isVNode(hydratedContent)) {
                frag.vnode = hydratedContent
                frag.$key = getVNodeKey(hydratedContent)
                trackSlotVNodeUpdates(frag, hydratedContent)
                // Forwarded slot fragments that resolve to an empty SSR range
                // should stay on that range instead of re-entering it through
                // generic Fragment hydration.
                if (
                  !hydrateForwardedEmptySlotFragment(
                    hydratedContent,
                    parentComponent,
                  )
                ) {
                  hydrateVNode(hydratedContent, parentComponent as any)
                }
                setRenderedContent(hydratedContent)
              } else if (hydratedContent) {
                frag.vnode = null
                frag.$key = undefined
                setRenderedContent(hydratedContent as Block)
              } else {
                frag.vnode = null
                frag.$key = undefined
                setRenderedContent(null)
              }
              finishContentUpdate(true)
              return
            }

            if (isVNode(slotContent)) {
              frag.vnode = slotContent
              frag.$key = getVNodeKey(slotContent)
              trackSlotVNodeUpdatesWithRefresh(slotContent, () => {
                const prevValid = contentState.valid
                const prevOutput = frag.nodes
                setRenderedContent(slotContent)
                controller.recheck()
                updateNodes()
                if (
                  contentState.valid !== prevValid ||
                  !isSameResolvedOutput(prevOutput, frag.nodes)
                ) {
                  notifyUpdated()
                }
              })
              const prevRendered = contentState.rendered
              if (prevRendered && !isVNode(prevRendered)) {
                remove(prevRendered, currentParentNode)
              }
              internals.p(
                isVNode(prevRendered) ? prevRendered : null,
                slotContent,
                currentParentNode!,
                currentAnchor,
                parentComponent as any,
                suspense,
                undefined, // namespace
                slotContent.slotScopeIds, // pass slotScopeIds for :slotted styles
              )
              setRenderedContent(slotContent)
              finishContentUpdate()
              return
            }

            if (slotContent) {
              frag.vnode = null
              frag.$key = undefined
              const prevRendered = contentState.rendered
              if (isVNode(prevRendered)) {
                internals.um(prevRendered, parentComponent as any, null, true)
              } else if (prevRendered) {
                remove(prevRendered, currentParentNode)
              }
              insert(slotContent, currentParentNode!, currentAnchor)
              setRenderedContent(slotContent)
              finishContentUpdate()
              return
            }

            if (isVNode(contentState.rendered)) {
              internals.um(
                contentState.rendered,
                parentComponent as any,
                null,
                true,
              )
            } else if (contentState.rendered) {
              remove(contentState.rendered, currentParentNode)
            }
            frag.vnode = null
            frag.$key = undefined
            setRenderedContent(null)
            finishContentUpdate()
          }),
        )
      })
    } finally {
      simpleSetCurrentInstance(prev)
    }
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    scope.run(render)
    currentParentNode = currentHydrationNode!.parentNode as ParentNode
    currentAnchor = currentHydrationNode
    isMounted = true
  }

  return frag
}

export const vaporInteropPlugin: Plugin = app => {
  setInteropEnabled()
  const internals = ensureRenderer().internals
  app._context.vapor = extend(vaporInteropImpl, {
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
        () => (fallback() as VNodeArrayChildren).map(normalizeVNode),
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

const renderEmptyVNodes = (): VNodeArrayChildren => []

// Interop slot rendering only needs to restore slot-owner / keep-alive /
// boundary context here. Reusing VaporFragment.runWithRenderCtx() also
// changes component-instance and effect ownership, which makes forwarded
// VDOM fallback cleanup follow a different lifecycle.
function runWithFragmentRenderCtx<R>(fragment: VaporFragment, fn: () => R): R {
  const prevSlotOwner = setCurrentSlotOwner(fragment.slotOwner)
  const prevKeepAliveCtx = setCurrentKeepAliveCtx(fragment.keepAliveCtx)
  try {
    return withOwnedSlotBoundary(fragment.inheritedSlotBoundary, fn)
  } finally {
    setCurrentKeepAliveCtx(prevKeepAliveCtx)
    setCurrentSlotOwner(prevSlotOwner)
  }
}

type InteropSlotFallback = {
  (): any
  __vdom?: boolean
}

interface InteropVaporSlotState {
  localFallback: ShallowRef<InteropSlotFallback | undefined>
  outletFallback: ShallowRef<InteropSlotFallback | undefined>
}

function composeInteropLocalFallback(
  localFallback?: BlockFn,
  outletFallback?: BlockFn,
): BlockFn | undefined {
  if (!localFallback) return outletFallback
  if (!outletFallback) return localFallback
  return (...args: any[]) => {
    const local = localFallback(...args)
    if (isValidBlock(local)) {
      return local
    }
    const outlet = outletFallback(...args)
    return resolveSlotFallbackCarrierOwner(local) ? [outlet, local] : outlet
  }
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
  if (__FEATURE_SUSPENSE__ && parentSuspense) {
    prevSuspense = setParentSuspense(parentSuspense)
  }
  try {
    const slotState = resolveInteropVaporSlotState(vnode)
    // Most of the interop setup is shared, but slots that start with a local
    // VDOM fallback still need to let an inner SlotFragment own the active
    // fallback lifecycle. Forcing the interop wrapper to own that branch breaks
    // fallback blocks that can later resolve to an empty vnode list.
    const frag = new VaporFragment<Block>([])
    frag.validityPending = !isHydrating
    const inheritedBoundary = frag.inheritedSlotBoundary
    let contentNodes: Block = []
    let isResolvingContent = false
    let wrappedLocalFallback!: BlockFn
    let wrappedOutletFallback!: BlockFn
    let currentParentNode: ParentNode | null = null
    let currentAnchor: Node | null = null
    let slotScope: ReturnType<typeof effectScope> | undefined
    let disposed = false
    const controller = new SlotFallbackController({
      getParentBoundary: () => inheritedBoundary,
      getLocalFallback: () =>
        composeInteropLocalFallback(
          slotState.localFallback.value ? wrappedLocalFallback : undefined,
          slotState.outletFallback.value ? wrappedOutletFallback : undefined,
        ),
      getContent: () => contentNodes,
      getParentNode: () => {
        if (currentParentNode) return currentParentNode
        const carrierAnchor = findFirstSlotFallbackCarrierNode(contentNodes)
        return carrierAnchor
          ? (carrierAnchor.parentNode as ParentNode | null)
          : null
      },
      getAnchor: () => currentAnchor,
      runWithRenderCtx: fn => runWithFragmentRenderCtx(frag, fn),
      isBusy: () => isResolvingContent,
      isDisposed: () => disposed,
      syncEffectiveOutput: () => {
        frag.nodes = controller.getEffectiveOutput()
        frag.validityPending = false
      },
      onValidityChange: () => {
        if (inheritedBoundary) {
          inheritedBoundary.markDirty()
        }
      },
    })

    const dispose = (parentNode?: ParentNode): void => {
      if (disposed) return
      currentParentNode = parentNode || currentParentNode
      disposed = true
      controller.dispose()
      slotScope = undefined
      currentParentNode = null
      currentAnchor = null
    }

    try {
      wrappedLocalFallback = controller.wrapFallback(
        createFallback(
          () => (slotState.localFallback.value || renderEmptyVNodes)(),
          parentComponent,
          () =>
            !!slotState.localFallback.value &&
            !!slotState.localFallback.value.__vdom,
        ),
      )
      wrappedOutletFallback = controller.wrapFallback(
        createFallback(
          () => (slotState.outletFallback.value || renderEmptyVNodes)(),
          parentComponent,
          () =>
            !!slotState.outletFallback.value &&
            !!slotState.outletFallback.value.__vdom,
        ),
      )
      const preferSlotFragmentOwnership =
        !!slotState.localFallback.value || !!slotState.outletFallback.value
      controller.clearPendingRecheck()
      const finalizeResolvedContent = (
        resolvedContent: Block | undefined,
      ): Block | undefined => {
        if (
          preferSlotFragmentOwnership &&
          resolvedContent instanceof SlotFragment
        ) {
          return resolvedContent
        }
        contentNodes = resolvedContent || []
        controller.recheck(controller.takePendingRecheck())
        return resolvedContent
      }
      let resolvedContent: Block | undefined
      isResolvingContent = true
      try {
        if (isHydrating) {
          resolvedContent = withHydratingSlotBoundary(() =>
            finalizeResolvedContent(
              runWithFragmentRenderCtx(frag, () => {
                const renderSlot = () =>
                  withOwnedSlotBoundary(controller.boundary, () =>
                    invokeVaporSlot(vnode),
                  )
                return controller.hasFallback()
                  ? withHydratingSlotFallbackActive(renderSlot)
                  : renderSlot()
              }),
            ),
          )
        } else {
          resolvedContent = finalizeResolvedContent(
            runWithFragmentRenderCtx(frag, () =>
              withOwnedSlotBoundary(controller.boundary, () =>
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
      if (
        preferSlotFragmentOwnership &&
        resolvedContent instanceof SlotFragment
      ) {
        dispose()
        return resolvedContent
      }

      controller.clearPendingRecheck()
      frag.insert = (parentNode, anchor) => {
        currentParentNode = parentNode
        currentAnchor = anchor
        if (controller.getActiveFallback()) {
          controller.relocate()
          insertSlotFallbackCarrier(contentNodes, parentNode, anchor)
        } else {
          insert(frag.nodes, parentNode, anchor)
        }
      }
      frag.remove = parentNode => {
        if (controller.getActiveFallback()) {
          removeSlotFallbackCarrier(contentNodes, parentNode)
        } else {
          remove(frag.nodes, parentNode)
        }
        dispose(parentNode)
      }
      trackInteropFallbackChanges(vnode.vs!.scope, slotState, () => {
        controller.recheck(true)
        controller.syncActiveFallback()
      })

      return frag
    } catch (e) {
      dispose()
      stopVaporSlotScope(vnode)
      throw e
    }
  } finally {
    if (__FEATURE_SUSPENSE__ && parentSuspense) {
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

interface VNodeHookState {
  vnode: VNode
  skipVnodeHooks: boolean
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
    }
    vnodeHookStateMap.set(instance, state)
    ;(instance.bu || (instance.bu = [])).push(() => {
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

    // Sync the outer component vnode before running any updated hooks so
    // both component updated hooks and onVnodeUpdated see the latest root el.
    ;(instance.u || (instance.u = [])).unshift(() =>
      syncVNodeEl(state!.vnode, instance),
    )
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
  const suspense =
    currentParentSuspense || (parentComponent && parentComponent.suspense)
  const frag = new VaporFragment<Block>([])
  frag.validityPending = !isHydrating
  let currentVNode: VNode | null = null
  let currentChildren: VNode[] = []
  let currentParentNode: ParentNode | null = null
  let currentAnchor: Node | null = null
  let isMounted = false
  const scope = effectScope()

  const syncResolvedNodes = (children: VNode[] = currentChildren): boolean => {
    const prevValid = frag.validityPending ? true : isValidBlock(frag.nodes)
    if (children.length === 0) {
      frag.nodes = []
    } else if (children.length === 1) {
      frag.nodes = resolveVNodeNodes(children[0])
    } else {
      frag.nodes = children.map(resolveVNodeNodes) as Block[]
    }
    frag.validityPending = false
    return prevValid !== isValidBlock(frag.nodes)
  }

  const notifyUpdated = (validityChanged = false): void => {
    if (validityChanged && frag.inheritedSlotBoundary) {
      frag.inheritedSlotBoundary.markDirty()
    }
    if (isMounted && frag.onUpdated) {
      frag.onUpdated.forEach(hook => hook())
    }
  }

  const renderContent = () => {
    const prev = currentInstance
    simpleSetCurrentInstance(parentComponent)
    try {
      renderEffect(() => {
        runWithFragmentRenderCtx(frag, () => {
          const nextChildren = render()
          if (isHydrating) {
            nextChildren.forEach(vnode => hydrateVNode(vnode, parentComponent))
            currentChildren = nextChildren
            currentVNode = createVNode(Fragment, null, nextChildren)
            currentParentNode = currentHydrationNode!.parentNode as ParentNode
            currentAnchor = currentHydrationNode
            // Slot fallback hydration can preserve a local carrier anchor from an
            // inner empty branch (for example `v-if` / `v-for`) immediately before
            // the enclosing slot end anchor. Fragment patching needs the boundary
            // insertion point after that local anchor; otherwise later fallback
            // siblings patch in front of the carrier instead of after it.
            if (
              frag.inheritedSlotBoundary &&
              currentAnchor &&
              isHydrationAnchor(currentAnchor) &&
              currentAnchor !== getCurrentSlotEndAnchor() &&
              currentAnchor.nextSibling
            ) {
              currentAnchor = currentAnchor.nextSibling
            }
          } else if (!currentVNode) {
            currentChildren = nextChildren
            currentVNode = createVNode(Fragment, null, nextChildren)
            trackSlotVNodeUpdatesWithRefresh(currentVNode, () => {
              notifyUpdated(syncResolvedNodes(nextChildren))
            })
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
            trackSlotVNodeUpdatesWithRefresh(nextVNode, () => {
              notifyUpdated(syncResolvedNodes(nextChildren))
            })
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

          const validityChanged = syncResolvedNodes()
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

  frag.insert = (parentNode, anchor) => {
    if (isHydrating) return
    currentParentNode = parentNode
    currentAnchor = anchor
    if (!isMounted) {
      scope.run(renderContent)
      isMounted = true
    } else {
      currentChildren.forEach(vnode => {
        internals.m(
          vnode,
          parentNode,
          anchor,
          MoveType.REORDER,
          parentComponent as any,
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
    scope.run(renderContent)
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
