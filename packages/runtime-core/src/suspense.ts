import { VNode } from './vnode'
import { queuePostFlushCb } from './scheduler'

export const SuspenseSymbol = __DEV__ ? Symbol('Suspense key') : Symbol()

export interface SuspenseBoundary<HostNode, HostElement> {
  parent: SuspenseBoundary<HostNode, HostElement> | null
  contentTree: VNode<HostNode, HostElement> | null
  fallbackTree: VNode<HostNode, HostElement> | null
  deps: number
  isResolved: boolean
  bufferedJobs: Function[]
  container: HostElement
  resolve(): void
}

export function createSuspenseBoundary<HostNode, HostElement>(
  parent: SuspenseBoundary<HostNode, HostElement> | null,
  container: HostElement
): SuspenseBoundary<HostNode, HostElement> {
  const suspense: SuspenseBoundary<HostNode, HostElement> = {
    parent,
    container,
    deps: 0,
    contentTree: null,
    fallbackTree: null,
    isResolved: false,
    bufferedJobs: [],
    resolve() {
      suspense.isResolved = true
      let parent = suspense.parent
      let hasUnresolvedAncestor = false
      while (parent) {
        if (!parent.isResolved) {
          parent.bufferedJobs.push(...suspense.bufferedJobs)
          hasUnresolvedAncestor = true
          break
        }
      }
      if (!hasUnresolvedAncestor) {
        queuePostFlushCb(suspense.bufferedJobs)
      }
      suspense.isResolved = true
    }
  }

  return suspense
}
