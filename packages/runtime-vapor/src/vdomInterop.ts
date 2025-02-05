import {
  type ComponentInternalInstance,
  type ConcreteComponent,
  type Plugin,
  type RendererInternals,
  type VaporInteropInterface,
  createVNode,
  currentInstance,
  ensureRenderer,
  shallowRef,
  simpleSetCurrentInstance,
} from '@vue/runtime-dom'
import {
  type LooseRawProps,
  type LooseRawSlots,
  VaporComponentInstance,
  createComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { VaporFragment, insert } from './block'
import { extend, remove } from '@vue/shared'
import { type RawProps, rawPropsProxyHandlers } from './componentProps'
import type { RawSlots } from './componentSlots'

const vaporInteropImpl: Omit<
  VaporInteropInterface,
  'vdomMount' | 'vdomUnmount'
> = {
  mount(vnode, container, anchor, parentComponent) {
    const selfAnchor = (vnode.anchor = document.createComment('vapor'))
    container.insertBefore(selfAnchor, anchor)
    const prev = currentInstance
    simpleSetCurrentInstance(parentComponent)
    const propsRef = shallowRef(vnode.props)
    // @ts-expect-error
    const instance = (vnode.component = createComponent(vnode.type, {
      $: [() => propsRef.value],
    }))
    instance.rawPropsRef = propsRef
    mountComponent(instance, container, selfAnchor)
    simpleSetCurrentInstance(prev)
    return instance
  },

  update(n1, n2, shouldUpdate) {
    n2.component = n1.component
    if (shouldUpdate) {
      ;(n2.component as any as VaporComponentInstance).rawPropsRef!.value =
        n2.props
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
    remove(parentInstance.vdomChildren!, vnode.component)
    isMounted = false
  }

  return frag
}

export const vaporInteropPlugin: Plugin = app => {
  const internals = ensureRenderer().internals
  app._context.vapor = extend(vaporInteropImpl, {
    vdomMount: createVDOMComponent.bind(null, internals),
    vdomUnmount: internals.umt,
  })
}
