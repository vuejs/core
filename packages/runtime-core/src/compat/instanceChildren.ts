import { ShapeFlags } from '@vue/shared/src'
import { ComponentInternalInstance } from '../component'
import { ComponentPublicInstance } from '../componentPublicInstance'
import { VNode } from '../vnode'
import { assertCompatEnabled } from './compatConfig'
import { DeprecationTypes } from './deprecations'

export function getCompatChildren(
  instance: ComponentInternalInstance
): ComponentPublicInstance[] {
  assertCompatEnabled(DeprecationTypes.INSTANCE_CHILDREN)
  const root = instance.subTree
  const children: ComponentPublicInstance[] = []
  if (root) {
    walk(root, children)
  }
  return children
}

function walk(vnode: VNode, children: ComponentPublicInstance[]) {
  if (vnode.component) {
    children.push(vnode.component.proxy!)
  } else if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    const vnodes = vnode.children as VNode[]
    for (let i = 0; i < vnodes.length; i++) {
      walk(vnodes[i], children)
    }
  }
}
