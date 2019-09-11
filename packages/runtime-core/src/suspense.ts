import { VNode, normalizeVNode } from './vnode'
import { ShapeFlags } from '.'
import { isFunction } from '@vue/shared'

export const SuspenseSymbol = __DEV__ ? Symbol('Suspense key') : Symbol()

export interface SuspenseBoundary<
  HostNode = any,
  HostElement = any,
  HostVNode = VNode<HostNode, HostElement>
> {
  vnode: HostVNode
  parent: SuspenseBoundary<HostNode, HostElement> | null
  container: HostElement
  subTree: HostVNode
  fallbackTree: HostVNode
  deps: number
  isResolved: boolean
  isUnmounted: boolean
  effects: Function[]
  resolve(): void
}

export function createSuspenseBoundary<HostNode, HostElement>(
  vnode: VNode<HostNode, HostElement>,
  parent: SuspenseBoundary<HostNode, HostElement> | null,
  container: HostElement,
  resolve: () => void
): SuspenseBoundary<HostNode, HostElement> {
  return {
    vnode,
    parent,
    container,
    deps: 0,
    subTree: null as any, // will be set immediately after creation
    fallbackTree: null as any, // will be set immediately after creation
    isResolved: false,
    isUnmounted: false,
    effects: [],
    resolve
  }
}

export function normalizeSuspenseChildren(
  vnode: VNode
): {
  content: VNode
  fallback: VNode
} {
  const { shapeFlag, children } = vnode
  if (shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const { default: d, fallback } = children as any
    return {
      content: normalizeVNode(isFunction(d) ? d() : d),
      fallback: normalizeVNode(isFunction(fallback) ? fallback() : fallback)
    }
  } else {
    return {
      content: normalizeVNode(children as any),
      fallback: normalizeVNode(null)
    }
  }
}
