import { type VNode, isFragmentVNode } from './vnode'

/**
 * 展开 vnode 数组中所有 Fragment 节点，将它们的子节点平铺出来。
 */
export const unwrapFragment = (vnodes: VNode[] | undefined): VNode[] => {
  if (!vnodes) return []
  const result: VNode[] = []
  for (const vnode of vnodes) {
    if (isFragmentVNode(vnode)) {
      result.push(...unwrapFragment(vnode.children as VNode[]))
    } else {
      result.push(vnode)
    }
  }
  return result
}
