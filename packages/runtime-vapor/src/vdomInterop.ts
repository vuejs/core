import {
  type App,
  type ComponentInternalInstance,
  type ConcreteComponent,
  Fragment,
  type HydrationRenderer,
  type KeepAliveContext,
  MoveType,
  type Plugin,
  type RendererElement,
  type RendererInternals,
  type RendererNode,
  type ShallowRef,
  type Slots,
  type TransitionHooks,
  type VNode,
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
  isRef,
  isVNode,
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
} from '@vue/runtime-dom'
import {
  type LooseRawProps,
  type LooseRawSlots,
  type VaporComponent,
  VaporComponentInstance,
  createComponent,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { type Block, type VaporTransitionHooks, insert, remove } from './block'
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
import { VaporFragment, isFragment, setFragmentFallback } from './fragment'
import type { NodeRef } from './apiTemplateRef'
import { setTransitionHooks as setVaporTransitionHooks } from './components/Transition'
import {
  activate,
  deactivate,
  findParentKeepAlive,
} from './components/KeepAlive'

export const interopKey: unique symbol = Symbol(`interop`)

// mounting vapor components and slots in vdom
const vaporInteropImpl: Omit<
  VaporInteropInterface,
  'vdomMount' | 'vdomUnmount' | 'vdomSlot'
> = {
  mount(vnode, container, anchor, parentComponent) {
    let selfAnchor = (vnode.el = vnode.anchor = createTextNode())
    if (isHydrating) {
      // avoid vdom hydration children mismatch by the selfAnchor, delay its insertion
      queuePostFlushCb(() => container.insertBefore(selfAnchor, anchor))
    } else {
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
    mountComponent(instance, container, selfAnchor)
    simpleSetCurrentInstance(prev)
    return instance
  },

  update(n1, n2, shouldUpdate) {
    n2.component = n1.component
    n2.el = n2.anchor = n1.anchor
    if (shouldUpdate) {
      const instance = n2.component as any as VaporComponentInstance
      instance.rawPropsRef!.value = n2.props
      instance.rawSlotsRef!.value = n2.children
    }
  },

  unmount(vnode, doRemove) {
    const container = doRemove ? vnode.anchor!.parentNode : undefined
    if (vnode.component) {
      unmountComponent(vnode.component as any, container)
    } else if (vnode.vb) {
      remove(vnode.vb, container)
    }
    remove(vnode.anchor as Node, container)
  },

  /**
   * vapor slot in vdom
   */
  slot(n1: VNode, n2: VNode, container, anchor) {
    if (!n1) {
      // mount
      let selfAnchor: Node | undefined
      const { slot, fallback } = n2.vs!
      const propsRef = (n2.vs!.ref = shallowRef(n2.props))
      const slotBlock = slot(new Proxy(propsRef, vaporSlotPropsProxyHandler))
      // handle nested fragments
      if (fallback && isFragment(slotBlock)) {
        setFragmentFallback(slotBlock, createFallback(fallback))
        // use fragment's anchor when possible
        selfAnchor = slotBlock.anchor
      }
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

  move(vnode, container, anchor) {
    insert(vnode.vb || (vnode.component as any), container, anchor)
    insert(vnode.anchor as any, container, anchor)
  },

  hydrate(vnode, node, container, anchor, parentComponent) {
    vaporHydrateNode(node, () =>
      this.mount(vnode, container, anchor, parentComponent),
    )
    return _next(node)
  },
  hydrateSlot(vnode, node) {
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
    return _next(vnode.anchor as Node)
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
    }
    return slot
  },
}

let vdomHydrateNode: HydrationRenderer['hydrateNode'] | undefined

/**
 * Mount vdom component in vapor
 */
function createVDOMComponent(
  internals: RendererInternals,
  component: ConcreteComponent,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
): VaporFragment {
  const parentInstance = currentInstance as VaporComponentInstance
  const frag = new VaporFragment([])
  const vnode = (frag.vnode = createVNode(
    component,
    rawProps && extend({}, new Proxy(rawProps, rawPropsProxyHandlers)),
  ))
  const wrapper = new VaporComponentInstance(
    { props: component.props },
    rawProps as RawProps,
    rawSlots as RawSlots,
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
        findParentKeepAlive(parentInstance)!.getStorageContainer(),
        internals,
        parentInstance as any,
        null,
      )
      return
    }
    internals.umt(vnode.component!, null, !!parentNode)
  }

  frag.hydrate = () => {
    hydrateVNode(vnode, parentInstance as any)
    onScopeDispose(unmount, true)
    isMounted = true
    frag.nodes = vnode.el as any
  }

  vnode.scopeId = parentInstance && parentInstance.type.__scopeId!
  vnode.slotScopeIds = currentSlotScopeIds

  frag.insert = (parentNode, anchor, transition) => {
    if (isHydrating) return
    if (vnode.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      vdomActivate(
        vnode,
        parentNode,
        anchor,
        internals,
        parentInstance as any,
        null,
        undefined,
        false,
      )
    } else {
      const prev = currentInstance
      simpleSetCurrentInstance(parentInstance)
      if (!isMounted) {
        if (transition) setVNodeTransitionHooks(vnode, transition)
        internals.mt(
          vnode,
          parentNode,
          anchor,
          parentInstance as any,
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
          parentInstance as any,
        )
      }
      simpleSetCurrentInstance(prev)
    }

    frag.nodes = vnode.el as any
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

  let isMounted = false
  let fallbackNodes: Block | undefined
  let oldVNode: VNode | null = null

  frag.fallback = fallback
  frag.insert = (parentNode, anchor) => {
    if (isHydrating) return

    if (!isMounted) {
      render(parentNode, anchor)
      isMounted = true
    } else {
      // move
      internals.m(
        oldVNode!,
        parentNode,
        anchor,
        MoveType.REORDER,
        parentComponent as any,
      )
    }

    frag.remove = parentNode => {
      if (fallbackNodes) {
        remove(fallbackNodes, parentNode)
      } else if (oldVNode) {
        internals.um(oldVNode, parentComponent as any, null)
      }
    }
  }

  const render = (parentNode?: ParentNode, anchor?: Node | null) => {
    renderEffect(() => {
      let vnode: VNode | undefined
      let isValidSlot = false
      // only render slot if rawSlots is defined and slot nodes are not empty
      // otherwise, render fallback
      if (slotsRef.value) {
        vnode = renderSlot(
          slotsRef.value,
          isFunction(name) ? name() : name,
          props,
        )

        let children = vnode.children as any[]
        // handle forwarded vapor slot without its own fallback
        // use the fallback provided by the slot outlet
        ensureVaporSlotFallback(children, fallback as any)
        isValidSlot = children.length > 0
      }

      if (isValidSlot) {
        if (isHydrating) {
          // if slot content is a vnode, hydrate it
          // otherwise, it's a vapor Block that was already hydrated during
          // renderSlot
          if (isVNode(vnode)) {
            hydrateVNode(vnode!, parentComponent as any)
            oldVNode = vnode
            frag.nodes = vnode.el as any
          }
        } else {
          if (fallbackNodes) {
            remove(fallbackNodes, parentNode)
            fallbackNodes = undefined
          }
          internals.p(
            oldVNode,
            vnode!,
            parentNode!,
            anchor,
            parentComponent as any,
            null, // parentSuspense
            undefined, // namespace
            vnode!.slotScopeIds, // pass slotScopeIds for :slotted styles
          )
          oldVNode = vnode!
          frag.nodes = vnode!.el as any
        }
      } else {
        // for forwarded slot without its own fallback, use the fallback
        // provided by the slot outlet.
        // re-fetch `frag.fallback` as it may have been updated at `createSlot`
        fallback = frag.fallback
        if (fallback && !fallbackNodes) {
          fallbackNodes = fallback(internals, parentComponent)
          if (isHydrating) {
            // hydrate fallback
            if (isVNode(fallbackNodes)) {
              hydrateVNode(fallbackNodes, parentComponent as any)
              frag.nodes = fallbackNodes.el as any
            }
          } else {
            // mount fallback
            if (oldVNode) {
              internals.um(oldVNode, parentComponent as any, null, true)
            }
            insert(fallbackNodes, parentNode!, anchor)
            frag.nodes = fallbackNodes as any
          }
        }
        oldVNode = null
      }
    })
  }

  frag.hydrate = () => {
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
  locateHydrationNode()

  // skip fragment start anchor
  let node = currentHydrationNode!
  while (
    isComment(node, '[') &&
    // vnode is not a fragment
    vnode.type !== Fragment &&
    // not inside vdom slot
    !(
      isVaporComponent(parentComponent) &&
      isRef((parentComponent as VaporComponentInstance).rawSlots._)
    )
  ) {
    node = node.nextSibling!
  }
  if (currentHydrationNode !== node) setCurrentHydrationNode(node)

  if (!vdomHydrateNode) vdomHydrateNode = ensureHydrationRenderer().hydrateNode!
  const nextNode = vdomHydrateNode(
    currentHydrationNode!,
    vnode,
    parentComponent,
    null,
    null,
    false,
  )
  if (nextNode) setCurrentHydrationNode(nextNode)
  else advanceHydrationNode(node)
}

const createFallback =
  (fallback: () => any) =>
  (
    internals: RendererInternals<RendererNode, RendererElement>,
    parentComponent: ComponentInternalInstance | null,
  ) => {
    const fallbackNodes = fallback()

    // vnode slot, wrap it as a VaporFragment
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

    // vapor slot
    return fallbackNodes as Block
  }
