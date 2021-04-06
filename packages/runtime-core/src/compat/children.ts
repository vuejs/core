import { ShapeFlags } from '@vue/shared/src'
import { ComponentInternalInstance } from '../component'
import { ComponentPublicInstance } from '../componentPublicInstance'
import { VNode } from '../vnode'
import { DeprecationTypes, warnDeprecation } from './deprecations'

export function getInstanceChildren(
  instance: ComponentInternalInstance
): ComponentPublicInstance[] {
  __DEV__ && warnDeprecation(DeprecationTypes.INSTANCE_CHILDREN)
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
