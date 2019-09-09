import { VNode } from './vnode'

export const SuspenseSymbol = __DEV__ ? Symbol('Suspense key') : Symbol()

export interface SuspenseBoundary<
  HostNode,
  HostElement,
  HostVNode = VNode<HostNode, HostElement>
> {
  vnode: HostVNode
  parent: SuspenseBoundary<HostNode, HostElement> | null
  subTree: HostVNode | null
  oldSubTree: HostVNode | null
  fallbackTree: HostVNode | null
  oldFallbackTree: HostVNode | null
  deps: number
  isResolved: boolean
  bufferedJobs: Function[]
  onRetry(fn: Function): void
  retry(): void
  onResolve(fn: Function): void
  resolve(): void
}

export function createSuspenseBoundary<HostNode, HostElement>(
  vnode: VNode<HostNode, HostElement>,
  parent: SuspenseBoundary<HostNode, HostElement> | null
): SuspenseBoundary<HostNode, HostElement> {
  let retry: Function
  let resolve: Function
  const suspense: SuspenseBoundary<HostNode, HostElement> = {
    vnode,
    parent,
    deps: 0,
    subTree: null,
    oldSubTree: null,
    fallbackTree: null,
    oldFallbackTree: null,
    isResolved: false,
    bufferedJobs: [],
    onRetry(fn: Function) {
      retry = fn
    },
    retry() {
      retry()
    },
    onResolve(fn: Function) {
      resolve = fn
    },
    resolve() {
      resolve()
    }
  }

  return suspense
}
