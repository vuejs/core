import { VNode, normalizeVNode } from './vnode'
import { ShapeFlags } from '.'

export const SuspenseSymbol = __DEV__ ? Symbol('Suspense key') : Symbol()

export interface SuspenseBoundary<
  HostNode,
  HostElement,
  HostVNode = VNode<HostNode, HostElement>
> {
  vnode: HostVNode
  parent: SuspenseBoundary<HostNode, HostElement> | null
  container: HostElement
  subTree: HostVNode | null
  oldSubTree: HostVNode | null
  fallbackTree: HostVNode | null
  oldFallbackTree: HostVNode | null
  deps: number
  isResolved: boolean
  bufferedJobs: Function[]
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
    subTree: null,
    oldSubTree: null,
    fallbackTree: null,
    oldFallbackTree: null,
    isResolved: false,
    bufferedJobs: [],
    resolve
  }
}

export function normalizeSuspenseChildren(
  vnode: VNode
): {
  content: VNode
  fallback: VNode
} {
  const { shapeFlag } = vnode
  const children = vnode.children as any
  if (shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    return {
      content: normalizeVNode(children.default()),
      fallback: normalizeVNode(children.fallback ? children.fallback() : null)
    }
  } else {
    return {
      content: normalizeVNode(children),
      fallback: normalizeVNode(null)
    }
  }
}
