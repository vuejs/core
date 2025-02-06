import {
  type ComponentInternalInstance,
  type ConcreteComponent,
  type Plugin,
  type RendererInternals,
  type ShallowRef,
  type Slots,
  type VNode,
  type VaporInteropInterface,
  createVNode,
  currentInstance,
  ensureRenderer,
  renderSlot,
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
import { type Block, VaporFragment, insert, remove } from './block'
import { extend, isFunction, remove as removeItem } from '@vue/shared'
import { type RawProps, rawPropsProxyHandlers } from './componentProps'
import type { RawSlots, VaporSlot } from './componentSlots'
import { renderEffect } from './renderEffect'

const vaporInteropImpl: Omit<
  VaporInteropInterface,
  'vdomMount' | 'vdomUnmount' | 'vdomSlot'
> = {
  mount(vnode, container, anchor, parentComponent) {
    const selfAnchor = (vnode.anchor = document.createComment('vapor'))
    container.insertBefore(selfAnchor, anchor)
    const prev = currentInstance
    simpleSetCurrentInstance(parentComponent)

    const propsRef = shallowRef(vnode.props)
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
    mountComponent(instance, container, selfAnchor)
    simpleSetCurrentInstance(prev)
    return instance
  },

  update(n1, n2, shouldUpdate) {
    n2.component = n1.component
    if (shouldUpdate) {
      const instance = n2.component as any as VaporComponentInstance
      instance.rawPropsRef!.value = n2.props
      instance.rawSlotsRef!.value = n2.children
    }
  },

  unmount(vnode, doRemove) {
    const container = doRemove ? vnode.anchor!.parentNode : undefined
    unmountComponent(vnode.component as any, container)
  },

  move(vnode, container, anchor) {
    insert(vnode.component as any, container, anchor)
    insert(vnode.anchor as any, container, anchor)
  },
}

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
    // TODO slots
  }

  let isMounted = false
  const parentInstance = currentInstance as VaporComponentInstance
  frag.insert = (parent, anchor) => {
    if (!isMounted) {
      internals.mt(
        vnode,
        parent,
        anchor,
        parentInstance as any,
        null,
        undefined,
        false,
      )
      ;(parentInstance.vdomChildren || (parentInstance.vdomChildren = [])).push(
        vnode.component!,
      )
      isMounted = true
    } else {
      // TODO move
    }
  }
  frag.remove = () => {
    internals.umt(vnode.component!, null, true)
    removeItem(parentInstance.vdomChildren!, vnode.component)
  }

  return frag
}

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
  let parentNode: ParentNode
  let oldVNode: VNode | null = null

  frag.insert = (parent, anchor) => {
    parentNode = parent
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
          internals.p(oldVNode, vnode, parent, anchor, parentComponent as any)
          oldVNode = vnode
        } else {
          if (fallback && !fallbackNodes) {
            // mount fallback
            if (oldVNode) {
              internals.um(oldVNode, parentComponent as any, null, true)
            }
            insert((fallbackNodes = fallback(props)), parent, anchor)
          }
          oldVNode = null
        }
      })
      isMounted = true
    } else {
      // TODO move
    }

    frag.remove = () => {
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
}
