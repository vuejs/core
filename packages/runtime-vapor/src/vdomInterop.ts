import {
  type App,
  type ComponentInternalInstance,
  type ConcreteComponent,
  MoveType,
  type Plugin,
  type RendererInternals,
  type ShallowRef,
  type Slots,
  type TransitionHooks,
  type VNode,
  type VaporInteropInterface,
  createVNode,
  currentInstance,
  ensureRenderer,
  onScopeDispose,
  renderSlot,
  setTransitionHooks as setVNodeTransitionHooks,
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
import {
  type Block,
  VaporFragment,
  type VaporTransitionHooks,
  insert,
  remove,
} from './block'
import { EMPTY_OBJ, extend, isFunction, isReservedProp } from '@vue/shared'
import { type RawProps, rawPropsProxyHandlers } from './componentProps'
import type { RawSlots, VaporSlot } from './componentSlots'
import { renderEffect } from './renderEffect'
import { createTextNode } from './dom/node'
import { optimizePropertyLookup } from './dom/prop'
import { setTransitionHooks as setVaporTransitionHooks } from './components/Transition'

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

    // @ts-expect-error
    const instance = (vnode.component = createComponent(
      vnode.type as any as VaporComponent,
      {
        $: [() => propsRef.value],
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
      const selfAnchor = (n2.el = n2.anchor = createTextNode())
      insert(selfAnchor, container, anchor)
      const { slot, fallback } = n2.vs!
      const propsRef = (n2.vs!.ref = shallowRef(n2.props))
      const slotBlock = slot(new Proxy(propsRef, vaporSlotPropsProxyHandler))
      // TODO fallback for slot with v-if content
      // fallback is a vnode slot function here, and slotBlock, if a DynamicFragment,
      // expects a Vapor BlockFn as fallback
      fallback
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
    if (key === '_vapor') {
      return target
    } else {
      return target[key]
    }
  },
}

/**
 * Mount vdom component in vapor
 */
function createVDOMComponent(
  internals: RendererInternals,
  component: ConcreteComponent,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
): VaporFragment {
  const frag = new VaporFragment([])
  const vnode = createVNode(
    component,
    rawProps && new Proxy(rawProps, rawPropsProxyHandlers),
  )
  const wrapper = new VaporComponentInstance(
    { props: component.props },
    rawProps as RawProps,
    rawSlots as RawSlots,
  )

  // overwrite how the vdom instance handles props
  vnode.vi = (instance: ComponentInternalInstance) => {
    instance.props = wrapper.props
    instance.attrs = wrapper.attrs
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

  frag.insert = (parentNode, anchor, transition) => {
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

  frag.insert = (parentNode, anchor) => {
    if (!isMounted) {
      renderEffect(() => {
        const vnode = renderSlot(
          slotsRef.value,
          isFunction(name) ? name() : name,
          props,
        )
        if ((vnode.children as any[]).length) {
          if (fallbackNodes) {
            remove(fallbackNodes, parentNode)
            fallbackNodes = undefined
          }
          internals.p(
            oldVNode,
            vnode,
            parentNode,
            anchor,
            parentComponent as any,
          )
          oldVNode = vnode
        } else {
          if (fallback && !fallbackNodes) {
            // mount fallback
            if (oldVNode) {
              internals.um(oldVNode, parentComponent as any, null, true)
            }
            insert((fallbackNodes = fallback(props)), parentNode, anchor)
          }
          oldVNode = null
        }
      })
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
