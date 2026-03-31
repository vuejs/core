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
  type RendererElement,
  type RendererInternals,
  type RendererNode,
  type ShallowRef,
  type Slots,
  Static,
  type SuspenseBoundary,
  type TransitionHooks,
  type VNode,
  type VNodeArrayChildren,
  type VNodeNormalizedRef,
  type VaporInteropInterface,
  callWithAsyncErrorHandling,
  createInternalObject,
  createVNode,
  currentInstance,
  ensureHydrationRenderer,
  ensureRenderer,
  ensureVaporSlotFallback,
  invokeDirectiveHook,
  isEmitListener,
  isKeepAlive,
  isVNode,
  isHydrating as isVdomHydrating,
  normalizeRef,
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
import {
  currentSlotOwner,
  currentSlotScopeIds,
  setCurrentSlotOwner,
} from './componentSlots'
import { renderEffect } from './renderEffect'
import { _next, createTextNode } from './dom/node'
import { optimizePropertyLookup } from './dom/prop'
import {
  advanceHydrationNode,
  currentHydrationNode,
  isComment,
  isHydrating,
  setCurrentHydrationNode,
  hydrateNode as vaporHydrateNode,
} from './dom/hydration'
import {
  VaporFragment,
  attachSlotFallback,
  isFragment,
  renderSlotFallback,
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
    ))
    instance.rawPropsRef = propsRef
    instance.rawSlotsRef = slotsRef

    // copy the shape flag from the vdom component if inside a keep-alive
    if (isKeepAlive(parentComponent)) instance.shapeFlag = vnode.shapeFlag

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

    // invoke onVnodeBeforeMount hook
    const vnodeBeforeMountHook = vnode.props && vnode.props.onVnodeBeforeMount
    if (vnodeBeforeMountHook) {
      callWithAsyncErrorHandling(
        vnodeBeforeMountHook,
        parentComponent,
        ErrorCodes.VNODE_HOOK,
        [vnode],
      )
    }

    mountComponent(instance, container, selfAnchor)

    // invoke onVnodeMounted hook
    queuePostFlushCb(() => {
      const vnodeHook = vnode.props && vnode.props.onVnodeMounted
      if (vnodeHook) {
        callWithAsyncErrorHandling(
          vnodeHook,
          parentComponent,
          ErrorCodes.VNODE_HOOK,
          [vnode],
        )
      }
    })

    simpleSetCurrentInstance(prev)
    return instance
  },

  update(n1, n2, shouldUpdate, onBeforeUpdate) {
    n2.component = n1.component
    n2.el = n2.anchor = n1.anchor

    const instance = n2.component as any as VaporComponentInstance

    const rootEl = getRootElement(instance)
    if (rootEl) {
      n2.el = rootEl
    }
    // invoke directive hooks only when we have a valid root element
    if (n2.dirs) {
      if (rootEl) {
        onBeforeUpdate && onBeforeUpdate()
      } else {
        n2.dirs = null
      }
    }

    if (shouldUpdate) {
      instance.rawPropsRef!.value = filterReservedProps(n2.props)
      instance.rawSlotsRef!.value = n2.children
    }
  },

  unmount(vnode, doRemove) {
    const container = doRemove ? vnode.anchor!.parentNode : undefined
    const instance = vnode.component as any as VaporComponentInstance
    if (instance) {
      // the async component may not be resolved yet, block is null
      if (instance.block) {
        unmountComponent(instance, container)
      }
    } else if (vnode.vb) {
      remove(vnode.vb, container)
      stopVaporSlotScope(vnode)
    }
    remove(vnode.anchor as Node, container)
    // invoke onVnodeUnmounted hook
    const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted
    if (vnodeHook) {
      queuePostFlushCb(() => {
        callWithAsyncErrorHandling(
          vnodeHook,
          instance && instance.parent,
          ErrorCodes.VNODE_HOOK,
          [vnode],
        )
      })
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
      }
    }
  },

  move(vnode, container, anchor, moveType) {
    move(vnode.vb || (vnode.component as any), container, anchor, moveType)
    move(vnode.anchor as any, container, anchor, moveType)
  },

  hydrate(vnode, node, container, anchor, parentComponent, parentSuspense) {
    // Check both vapor's isHydrating (for createVaporSSRApp) and
    // VDOM's isVdomHydrating (for createSSRApp).
    // In CSR (createApp/createVaporApp + vaporInteropPlugin), both are false,
    // so this logic is tree-shaken.
    if (!isHydrating && !isVdomHydrating) return node
    vaporHydrateNode(node, () =>
      this.mount(vnode, container, anchor, parentComponent, parentSuspense),
    )
    return _next(node)
  },

  hydrateSlot(vnode, node) {
    if (!isHydrating && !isVdomHydrating) return node
    vaporHydrateNode(node, () => {
      vnode.vb = invokeVaporSlot(vnode)
      vnode.anchor = vnode.el = currentHydrationNode!

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
    activate(instance, container, anchor)
    insert(vnode.anchor as any, container, anchor)
    if (shouldUpdate) {
      instance.rawPropsRef!.value = filterReservedProps(vnode.props)
      instance.rawSlotsRef!.value = vnode.children
      if (vnode.dirs) {
        invokeDirectiveHook(vnode, cached, parentComponent, 'beforeUpdate')
      }
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
    }
    queuePostFlushCb(() => {
      if (shouldUpdate) {
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
      }

      const vnodeMountedHook = vnode.props && vnode.props.onVnodeMounted
      if (vnodeMountedHook) {
        callWithAsyncErrorHandling(
          vnodeMountedHook,
          parentComponent,
          ErrorCodes.VNODE_HOOK,
          [vnode],
        )
      }
    })
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

const vaporSlotsProxyHandler: ProxyHandler<any> = {
  get(target, key) {
    const slot = target[key]
    if (isFunction(slot)) {
      slot.__vapor = true
      // Create a wrapper that internally uses renderSlot for proper vapor slot handling
      // This ensures that calling slots.default() works the same as renderSlot(slots, 'default')
      const wrapped = (props?: Record<string, any>) => [
        renderSlot({ [key]: slot }, key as string, props),
      ]
      ;(wrapped as any).__vs = slot
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

  const wrapper = new VaporComponentInstance(
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
  const refresh = () => {
    frag.nodes = resolveVNodeNodes(vnode)
    if (frag.onUpdated) frag.onUpdated.forEach(m => m())
  }

  const track = (node: VNode) => {
    appendVnodeUpdatedHook(node, refresh)
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
  const instance = currentInstance
  const slotOwner = currentSlotOwner

  if (fallback && !frag.fallback) frag.fallback = fallback

  let isMounted = false
  let currentBlock: Block | null = null
  let currentVNode: VNode | null = null

  frag.insert = (parentNode, anchor) => {
    if (isHydrating) return

    if (!isMounted) {
      render(parentNode, anchor)
      isMounted = true
    } else {
      if (currentVNode) {
        // move vdom content
        internals.m(
          currentVNode,
          parentNode,
          anchor,
          MoveType.REORDER,
          parentComponent as any,
        )
      } else if (currentBlock) {
        // move vapor content
        insert(currentBlock, parentNode, anchor)
      }
    }

    frag.remove = parentNode => {
      if (currentBlock) {
        remove(currentBlock, parentNode)
      } else if (currentVNode) {
        internals.um(currentVNode, parentComponent as any, null, true)
      }
    }

    if (isMounted && frag.onUpdated) frag.onUpdated.forEach(m => m())
  }

  const render = (parentNode?: ParentNode, anchor?: Node | null) => {
    const prev = currentInstance
    simpleSetCurrentInstance(instance)
    try {
      renderEffect(() => {
        const prevSlotOwner = setCurrentSlotOwner(slotOwner)
        try {
          const effectiveFallback = frag.fallback || fallback
          let slotContent: VNode | Block | undefined
          let isEmpty = true
          let emptyFrag: VaporFragment | null = null

          if (slotsRef.value) {
            slotContent = renderSlot(
              slotsRef.value,
              isFunction(name) ? name() : name,
              props,
            )

            if (isVNode(slotContent)) {
              const children = slotContent.children as VNode[]
              // handle forwarded vapor slot without its own fallback
              // use the fallback provided by the slot outlet
              ensureVaporSlotFallback(
                children,
                effectiveFallback as () => VNodeArrayChildren,
              )
              isEmpty = children.length === 0
            } else {
              if (effectiveFallback && slotContent) {
                emptyFrag = attachSlotFallback(slotContent, () =>
                  effectiveFallback(internals, parentComponent),
                )
              }
              isEmpty = !isValidBlock(slotContent)
            }
          }

          let resolved = slotContent
          if (isEmpty && effectiveFallback) {
            if (isVNode(slotContent)) {
              resolved = effectiveFallback(internals, parentComponent)
            } else if (slotContent) {
              resolved = renderSlotFallback(
                slotContent,
                () => effectiveFallback(internals, parentComponent),
                emptyFrag,
              )
            } else {
              resolved = effectiveFallback(internals, parentComponent)
            }
          }

          if (isHydrating) {
            if (isVNode(resolved)) {
              frag.vnode = resolved
              frag.$key = getVNodeKey(resolved)
              trackSlotVNodeUpdates(frag, resolved)
              hydrateVNode(resolved, parentComponent as any)
              currentVNode = resolved
              currentBlock = null
              frag.nodes = resolveVNodeNodes(resolved)
            } else if (resolved) {
              currentBlock = resolved as Block
              currentVNode = null
              frag.nodes = resolved as any
            } else {
              currentBlock = null
              currentVNode = null
              frag.nodes = []
            }
            return
          }

          if (isVNode(resolved)) {
            frag.vnode = resolved
            frag.$key = getVNodeKey(resolved)
            trackSlotVNodeUpdates(frag, resolved)
            if (currentBlock) {
              remove(currentBlock, parentNode)
              currentBlock = null
            }
            internals.p(
              currentVNode,
              resolved,
              parentNode!,
              anchor,
              parentComponent as any,
              suspense,
              undefined, // namespace
              resolved.slotScopeIds, // pass slotScopeIds for :slotted styles
            )
            currentVNode = resolved
            frag.nodes = resolveVNodeNodes(resolved)
            return
          }

          if (resolved) {
            frag.vnode = null
            frag.$key = undefined
            if (currentVNode) {
              internals.um(currentVNode, parentComponent as any, null, true)
              currentVNode = null
            }
            if (currentBlock) {
              remove(currentBlock, parentNode)
            }
            insert(resolved, parentNode!, anchor)
            currentBlock = resolved
            frag.nodes = resolved as any
            return
          }

          if (currentBlock) {
            remove(currentBlock, parentNode)
            currentBlock = null
          }
          if (currentVNode) {
            internals.um(currentVNode, parentComponent as any, null, true)
            currentVNode = null
          }

          // mark as empty
          frag.vnode = null
          frag.$key = undefined
          frag.nodes = []
        } finally {
          setCurrentSlotOwner(prevSlotOwner)
        }
      })
    } finally {
      simpleSetCurrentInstance(prev)
    }
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    render()
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

function createVaporFallback(
  fallback: () => any,
  parentComponent: ComponentInternalInstance | null,
): BlockFn {
  const internals = ensureRenderer().internals
  return () => createFallback(fallback)(internals, parentComponent)
}

const createFallback =
  (fallback: () => any) =>
  (
    internals: RendererInternals<RendererNode, RendererElement>,
    parentComponent: ComponentInternalInstance | null,
  ) => {
    const fallbackNodes = fallback()

    // vnode content, wrap it as a VaporFragment
    if (isArray(fallbackNodes) && fallbackNodes.every(isVNode)) {
      const frag = new VaporFragment([])
      frag.insert = (parentNode, anchor) => {
        fallbackNodes.forEach(vnode => {
          internals.p(null, vnode, parentNode, anchor, parentComponent)
        })
      }
      frag.remove = parentNode => {
        fallbackNodes.forEach(vnode => {
          internals.um(vnode, parentComponent, null, true)
        })
      }
      return frag
    }

    // vapor block
    return fallbackNodes as Block
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
    const { fallback } = vnode.vs!
    let slotBlock = invokeVaporSlot(vnode)
    if (!fallback) {
      return slotBlock
    }

    const vaporFallback = createVaporFallback(fallback, parentComponent)
    const emptyFrag = attachSlotFallback(slotBlock, vaporFallback)
    if (!isValidBlock(slotBlock)) {
      slotBlock = renderSlotFallback(slotBlock, vaporFallback, emptyFrag)
    }
    return slotBlock
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
