import {
  type Plugin,
  type VaporInVDOMInterface,
  currentInstance,
  shallowRef,
  simpleSetCurrentInstance,
} from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  createComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { insert } from './block'

const vaporInVDOMInterface: VaporInVDOMInterface = {
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

export const vaporInteropPlugin: Plugin = app => {
  app.config.vapor = vaporInVDOMInterface
}
