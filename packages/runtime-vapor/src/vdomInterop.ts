import {
  type GenericComponentInstance,
  type Plugin,
  type VNode,
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
  mount(
    vnode: VNode,
    container: ParentNode,
    anchor: Node,
    parentComponent: GenericComponentInstance | null,
  ) {
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

  update(n1: VNode, n2: VNode) {
    n2.component = n1.component
    // TODO if has patchFlag, do simple diff to skip unnecessary updates
    ;(n2.component as any as VaporComponentInstance).rawPropsRef!.value =
      n2.props
  },

  unmount(vnode: VNode, doRemove?: boolean) {
    const container = doRemove ? vnode.anchor!.parentNode : undefined
    unmountComponent(vnode.component as any, container)
  },

  move(vnode: VNode, container: ParentNode, anchor: Node) {
    insert(vnode.component as any, container, anchor)
    insert(vnode.anchor as any, container, anchor)
  },
}

export const vaporInteropPlugin: Plugin = app => {
  app.config.vapor = vaporInVDOMInterface
}
