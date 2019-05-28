import { VNode, normalizeVNode } from './vnode'

export class Component {}

export function renderComponentRoot(instance: any): VNode {
  return normalizeVNode(instance.render(instance.vnode.props))
}

export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode
): boolean {
  const { props: prevProps } = prevVNode
  const { props: nextProps } = nextVNode

  // TODO handle slots
  // If has different slots content, or has non-compiled slots,
  // the child needs to be force updated.
  // if (
  //   prevChildFlags !== nextChildFlags ||
  //   (nextChildFlags & ChildrenFlags.DYNAMIC_SLOTS) > 0
  // ) {
  //   return true
  // }

  if (prevProps === nextProps) {
    return false
  }
  if (prevProps === null) {
    return nextProps !== null
  }
  if (nextProps === null) {
    return prevProps !== null
  }
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (nextProps[key] !== prevProps[key]) {
      return true
    }
  }
  return false
}
