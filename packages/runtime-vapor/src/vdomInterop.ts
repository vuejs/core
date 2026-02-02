import {
  type App,
  type ComponentInternalInstance,
  type ConcreteComponent,
  type HydrationRenderer,
  type KeepAliveContext,
  MoveType,
  type Plugin,
  type RendererElement,
  type RendererInternals,
  type RendererNode,
  type ShallowRef,
  type Slots,
  type SuspenseBoundary,
  type TransitionHooks,
  type VNode,
  type VNodeArrayChildren,
  type VNodeNormalizedRef,
  type VaporInteropInterface,
  createInternalObject,
  createVNode,
  currentInstance,
  ensureHydrationRenderer,
  ensureRenderer,
  ensureVaporSlotFallback,
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
  simpleSetCurrentInstance,
  activate as vdomActivate,
  deactivate as vdomDeactivate,
  setRef as vdomSetRef,
  warn,
} from '@vue/runtime-dom'
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
  ShapeFlags,
  extend,
  isArray,
  isFunction,
  isReservedProp,
} from '@vue/shared'
import { type RawProps, rawPropsProxyHandlers } from './componentProps'
import type { RawSlots, VaporSlot } from './componentSlots'
import { currentSlotScopeIds } from './componentSlots'
import { renderEffect } from './renderEffect'
import { _next, createTextNode } from './dom/node'
import { optimizePropertyLookup } from './dom/prop'
import {
  advanceHydrationNode,
  currentHydrationNode,
  isComment,
  isHydrating,
  locateHydrationNode,
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
import { setTransitionHooks as setVaporTransitionHooks } from './components/Transition'
import {
  type KeepAliveInstance,
  activate,
  currentKeepAliveCtx,
  deactivate,
  setCurrentKeepAliveCtx,
} from './components/KeepAlive'
import { setParentSuspense } from './components/Suspense'

export const interopKey: unique symbol = Symbol(`interop`)

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

    // filter out reserved props
    const props: VNode['props'] = {}
    for (const key in vnode.props) {
      if (!isReservedProp(key)) {
        props[key] = vnode.props[key]
      }
    }

    const propsRef = shallowRef(props)
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

    mountComponent(instance, container, selfAnchor)

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
      instance.rawPropsRef!.value = n2.props
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
    }
    remove(vnode.anchor as Node, container)
  },

  /**
   * vapor slot in vdom
   */
  slot(n1: VNode, n2: VNode, container, anchor, parentComponent) {
    if (!n1) {
      const prev = currentInstance
      simpleSetCurrentInstance(parentComponent)
      // mount
      let selfAnchor: Node | undefined
      const { slot, fallback } = n2.vs!
      const propsRef = (n2.vs!.ref = shallowRef(n2.props))
      let slotBlock = slot(new Proxy(propsRef, vaporSlotPropsProxyHandler))
      if (fallback) {
        const vaporFallback = createVaporFallback(fallback, parentComponent)
        attachSlotFallback(slotBlock, vaporFallback)
        if (!isValidBlock(slotBlock)) {
          slotBlock = renderSlotFallback(slotBlock, vaporFallback)
        }
      }
      if (isFragment(slotBlock)) {
        // use fragment's anchor when possible
        selfAnchor = slotBlock.anchor
      }
      simpleSetCurrentInstance(prev)
      if (!selfAnchor) selfAnchor = createTextNode()
      insert((n2.el = n2.anchor = selfAnchor), container, anchor)
      insert((n2.vb = slotBlock), container, selfAnchor)
    } else {
      // update
      n2.el = n2.anchor = n1.anchor
      n2.vb = n1.vb
      ;(n2.vs!.ref = n1.vs!.ref)!.value = n2.props
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
    const { slot } = vnode.vs!
    const propsRef = (vnode.vs!.ref = shallowRef(vnode.props))
    vaporHydrateNode(node, () => {
      vnode.vb = slot(new Proxy(propsRef, vaporSlotPropsProxyHandler))
      vnode.anchor = vnode.el = currentHydrationNode!

      if (__DEV__ && !vnode.anchor) {
        throw new Error(
          `Failed to locate slot anchor. this is likely a Vue internal bug.`,
        )
      }
    })
    return vnode.anchor as Node
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
    activate(vnode.component as any, container, anchor)
    insert(vnode.anchor as any, container, anchor)
  },

  deactivate(vnode, container) {
    deactivate(vnode.component as any, container)
    insert(vnode.anchor as any, container)
  },
}

const vaporSlotPropsProxyHandler: ProxyHandler<
  ShallowRef<Record<string, any>>
> = {
  get(target, key: any) {
    return target.value[key]
  },
  has(target, key: any) {
    return target.value[key]
  },
  ownKeys(target) {
    return Object.keys(target.value)
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

/**
 * Mount VNode in vapor
 */
function mountVNode(
  internals: RendererInternals,
  vnode: VNode,
  parentComponent: VaporComponentInstance | null,
): VaporFragment {
  const frag = new VaporFragment([])
  frag.vnode = vnode

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
    frag.nodes = vnode.el as any
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
          null, // parentSuspense
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
    frag.nodes = vnode.el as any
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
  isSingleRoot?: boolean,
): VaporFragment {
  const frag = new VaporFragment([])
  const vnode = (frag.vnode = createVNode(
    component,
    rawProps && extend({}, new Proxy(rawProps, rawPropsProxyHandlers)),
  ))

  if (currentKeepAliveCtx) {
    currentKeepAliveCtx.processShapeFlag(frag)
    setCurrentKeepAliveCtx(null)
  }

  const wrapper = new VaporComponentInstance(
    { props: component.props },
    rawProps as RawProps,
    rawSlots as RawSlots,
    parentComponent ? parentComponent.appContext : undefined,
    undefined,
  )

  // overwrite how the vdom instance handles props
  vnode.vi = (instance: ComponentInternalInstance) => {
    // ensure props are shallow reactive to align with VDOM behavior.
    instance.props = shallowReactive(wrapper.props)

    const attrs = (instance.attrs = createInternalObject())
    for (const key in wrapper.attrs) {
      if (!isEmitListener(instance.emitsOptions, key)) {
        attrs[key] = wrapper.attrs[key]
      }
    }

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
    hydrateVNode(
      vnode,
      parentComponent as any,
      // skip fragment start anchor for multi-root component
      // to avoid mismatch
      !isSingleRoot,
    )
    onScopeDispose(unmount, true)
    isMounted = true
    frag.nodes = vnode.el as any
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
          null,
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

    frag.nodes = vnode.el as any
    if (isMounted && frag.onUpdated) frag.onUpdated.forEach(m => m())
  }

  frag.remove = unmount

  frag.setRef = (
    instance: VaporComponentInstance,
    ref: NodeRef,
    refFor: boolean,
    refKey: string | undefined,
  ): void => {
    rawRef = normalizeRef(
      {
        ref: ref as any,
        ref_for: refFor,
        ref_key: refKey,
      },
      instance as any,
    )

    if (isMounted && rawRef) {
      vdomSetRef(rawRef, null, null, vnode)
    }
  }

  return frag
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
  const frag = new VaporFragment([])

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
        internals.um(currentVNode, parentComponent as any, null)
      }
    }

    if (isMounted && frag.onUpdated) frag.onUpdated.forEach(m => m())
  }

  const render = (parentNode?: ParentNode, anchor?: Node | null) => {
    renderEffect(() => {
      const effectiveFallback = frag.fallback || fallback
      let slotContent: VNode | Block | undefined
      let isEmpty = true

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
            attachSlotFallback(slotContent, () =>
              effectiveFallback(internals, parentComponent),
            )
          }
          isEmpty = !isValidBlock(slotContent as Block)
        }
      }

      let resolved = slotContent
      if (isEmpty && effectiveFallback) {
        if (isVNode(slotContent)) {
          resolved = effectiveFallback(internals, parentComponent)
        } else if (slotContent) {
          resolved = renderSlotFallback(slotContent, () =>
            effectiveFallback(internals, parentComponent),
          )
        } else {
          resolved = effectiveFallback(internals, parentComponent)
        }
      }

      if (isHydrating) {
        if (isVNode(resolved)) {
          hydrateVNode(resolved, parentComponent as any)
          currentVNode = resolved
          currentBlock = null
          frag.nodes = resolved.el as any
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
        if (currentBlock) {
          remove(currentBlock, parentNode)
          currentBlock = null
        }
        const prevVNode = currentVNode
        internals.p(
          prevVNode,
          resolved,
          parentNode!,
          anchor,
          parentComponent as any,
          null, // parentSuspense
          undefined, // namespace
          resolved.slotScopeIds, // pass slotScopeIds for :slotted styles
        )
        currentVNode = resolved
        frag.nodes = resolved.el as any
        return
      }

      if (resolved) {
        if (currentVNode) {
          internals.um(currentVNode, parentComponent as any, null, true)
          currentVNode = null
        }
        if (currentBlock !== resolved) {
          if (currentBlock) {
            remove(currentBlock, parentNode)
          }
          insert(resolved, parentNode!, anchor)
          currentBlock = resolved
        }
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
      frag.nodes = []
    })
  }

  frag.hydrate = () => {
    if (!isHydrating) return
    render()
    isMounted = true
  }

  return frag
}

export const vaporInteropPlugin: Plugin = app => {
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
  skipFragmentAnchor: boolean = false,
) {
  locateHydrationNode()

  let node = currentHydrationNode!
  if (skipFragmentAnchor && isComment(node, '[')) {
    setCurrentHydrationNode((node = node.nextSibling!))
  }

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
