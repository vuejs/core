import {
  type App,
  type ComponentInternalInstance,
  type ConcreteComponent,
  type HydrationRenderer,
  MoveType,
  type Plugin,
  type RendererElement,
  type RendererInternals,
  type RendererNode,
  type ShallowRef,
  type Slots,
  type TransitionHooks,
  type VNode,
  type VaporInteropInterface,
  createInternalObject,
  createVNode,
  currentInstance,
  ensureHydrationRenderer,
  ensureRenderer,
  ensureVaporSlotFallback,
  isEmitListener,
  isVNode,
  onScopeDispose,
  renderSlot,
  setTransitionHooks as setVNodeTransitionHooks,
  shallowReactive,
  shallowRef,
  simpleSetCurrentInstance,
} from '@vue/runtime-dom'
import {
  type LooseRawProps,
  type LooseRawSlots,
  type VaporComponent,
  VaporComponentInstance,
  createComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { type Block, type VaporTransitionHooks, insert, remove } from './block'
import {
  EMPTY_OBJ,
  extend,
  isArray,
  isFunction,
  isReservedProp,
} from '@vue/shared'
import { type RawProps, rawPropsProxyHandlers } from './componentProps'
import type { RawSlots, VaporSlot } from './componentSlots'
import { renderEffect } from './renderEffect'
import { __next, createTextNode } from './dom/node'
import { optimizePropertyLookup } from './dom/prop'
import { setTransitionHooks as setVaporTransitionHooks } from './components/Transition'
import {
  currentHydrationNode,
  isHydrating,
  locateHydrationNode,
  locateVaporFragmentAnchor,
  setCurrentHydrationNode,
  hydrateNode as vaporHydrateNode,
} from './dom/hydration'
import { DynamicFragment, VaporFragment, isFragment } from './fragment'

export const interopKey: unique symbol = Symbol(`interop`)

// mounting vapor components and slots in vdom
const vaporInteropImpl: Omit<
  VaporInteropInterface,
  'vdomMount' | 'vdomUnmount' | 'vdomSlot'
> = {
  mount(vnode, container, anchor, parentComponent) {
    const selfAnchor = (vnode.el = vnode.anchor = createTextNode())
    container.insertBefore(selfAnchor, anchor)
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
    ))
    instance.rawPropsRef = propsRef
    instance.rawSlotsRef = slotsRef
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
      // forwarded vdom slot without its own fallback, use the fallback provided by
      // the slot outlet
      if (slotBlock instanceof DynamicFragment) {
        // vapor slot's nodes is a forwarded vdom slot
        let nodes = slotBlock.nodes
        while (isFragment(nodes)) {
          ensureVDOMSlotFallback(nodes, fallback)
          nodes = nodes.nodes
        }
        // use fragment's anchor when possible
        selfAnchor = slotBlock.anchor
      } else if (isFragment(slotBlock)) {
        ensureVDOMSlotFallback(slotBlock, fallback)
        selfAnchor = slotBlock.anchor!
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

  setTransitionHooks(component, hooks) {
    setVaporTransitionHooks(component as any, hooks as VaporTransitionHooks)
  },

  hydrate: vaporHydrateNode,
  hydrateSlot(vnode, container) {
    const { slot } = vnode.vs!
    const propsRef = (vnode.vs!.ref = shallowRef(vnode.props))
    const slotBlock = slot(new Proxy(propsRef, vaporSlotPropsProxyHandler))
    vaporHydrateNode(slotBlock, () => {
      const anchor = locateVaporFragmentAnchor(currentHydrationNode!, 'slot')!
      vnode.el = vnode.anchor = anchor
      insert((vnode.vb = slotBlock), container, anchor)
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
  scopeId?: string,
): VaporFragment {
  const frag = new VaporFragment([])
  const vnode = createVNode(
    component,
    rawProps && extend({}, new Proxy(rawProps, rawPropsProxyHandlers)),
  )
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

  let isMounted = false
  const parentInstance = currentInstance as VaporComponentInstance
  const unmount = (parentNode?: ParentNode, transition?: TransitionHooks) => {
    if (transition) setVNodeTransitionHooks(vnode, transition)
    internals.umt(vnode.component!, null, !!parentNode)
  }

  vnode.scopeId = parentInstance && parentInstance.type.__scopeId!

  frag.insert = (parentNode, anchor, transition) => {
    const prev = currentInstance
    simpleSetCurrentInstance(parentInstance)
    if (!isMounted || isHydrating) {
      if (transition) setVNodeTransitionHooks(vnode, transition)

      if (isHydrating) {
        hydrateVNode(vnode, parentInstance as any)
      } else {
        internals.mt(
          vnode,
          parentNode,
          anchor,
          parentInstance as any,
          null,
          undefined,
          false,
        )
      }
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

    // update the fragment nodes
    frag.nodes = [vnode.el as Node]
    simpleSetCurrentInstance(prev)
  }

  frag.remove = unmount

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
    if (!isMounted) {
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
            hydrateVNode(vnode!, parentComponent as any)
          } else {
            if (fallbackNodes) {
              remove(fallbackNodes, parentNode)
              fallbackNodes = undefined
            }
            internals.p(
              oldVNode,
              vnode!,
              parentNode,
              anchor,
              parentComponent as any,
              null,
              undefined,
              null,
              false,
            )
          }
          oldVNode = vnode!
        } else {
          // for forwarded slot without its own fallback, use the fallback
          // provided by the slot outlet.
          // re-fetch `frag.fallback` as it may have been updated at `createSlot`
          fallback = frag.fallback
          if (fallback && !fallbackNodes) {
            // mount fallback
            if (oldVNode) {
              internals.um(oldVNode, parentComponent as any, null, true)
            }
            insert(
              (fallbackNodes = fallback(internals, parentComponent)),
              parentNode,
              anchor,
            )
          } else if (isHydrating) {
            // update hydration node to the next sibling of the slot anchor
            locateHydrationNode()
            const nextNode = locateVaporFragmentAnchor(
              currentHydrationNode!,
              'slot',
            )
            if (nextNode) setCurrentHydrationNode(__next(nextNode))
          }
          oldVNode = null
        }
      })
      isMounted = true
    } else {
      // move
      if (oldVNode && !isHydrating) {
        internals.m(
          oldVNode,
          parentNode,
          anchor,
          MoveType.REORDER,
          parentComponent as any,
        )
      }
    }

    frag.remove = parentNode => {
      if (fallbackNodes) {
        remove(fallbackNodes, parentNode)
      } else if (oldVNode) {
        internals.um(oldVNode, parentComponent as any, null)
      }
    }
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

function ensureVDOMSlotFallback(block: VaporFragment, fallback?: () => any) {
  if (block.insert && !block.fallback && fallback) {
    block.fallback = createFallback(fallback)
  }
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
          // hydrate fallback
          if (isHydrating) {
            hydrateVNode(vnode, parentComponent as any)
          } else {
            internals.p(null, vnode, parentNode, anchor, parentComponent)
          }
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

function hydrateVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
) {
  // keep fragment start anchor, hydrateNode uses it to
  // determine if node is a fragmentStart
  locateHydrationNode()
  if (!vdomHydrateNode) vdomHydrateNode = ensureHydrationRenderer().hydrateNode!
  const nextNode = vdomHydrateNode(
    currentHydrationNode!,
    vnode,
    parentComponent,
    null,
    null,
    false,
  )
  setCurrentHydrationNode(nextNode)
}
