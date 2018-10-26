import { VNode, ChildrenFlags } from '@vue/runtime-core'

export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  prevVNode: VNode,
  unmountChildren: any
) {
  if (key === 'innerHTML' || key === 'textContent') {
    if (prevVNode && prevVNode.children) {
      unmountChildren(prevVNode.children, prevVNode.childFlags)
      prevVNode.children = null
      prevVNode.childFlags = ChildrenFlags.NO_CHILDREN
    }
  }
  el[key] = value
}
