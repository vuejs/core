import { ShapeFlags } from '@vue/shared'
import type { ComponentInternalInstance } from '../component'
import type { ComponentPublicInstance } from '../componentPublicInstance'
import type { VNode } from '../vnode'
import { DeprecationTypes, assertCompatEnabled } from './compatConfig'

export function getCompatChildren(
  instance: ComponentInternalInstance,
): ComponentPublicInstance[] {
  assertCompatEnabled(DeprecationTypes.INSTANCE_CHILDREN, instance)
  const root = instance.subTree
  const children: ComponentPublicInstance[] = []
  if (root) {
    walk(root, children)
  }
  return children
}

function walk(vnode: VNode, children: ComponentPublicInstance[]) {
  if (vnode.component) {
    // `proxy` is not available for functional components
    children.push(
      vnode.component.proxy ||
        (vnode.component.ctx as unknown as ComponentPublicInstance),
    )
  } else if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    const vnodes = vnode.children as VNode[]
    for (let i = 0; i < vnodes.length; i++) {
      walk(vnodes[i], children)
    }
  }
}
