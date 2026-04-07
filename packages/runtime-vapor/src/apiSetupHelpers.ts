import {
  withAsyncContext as baseWithAsyncContext,
  currentInstance,
} from '@vue/runtime-dom'
import {
  currentHydrationNode,
  enterHydration,
  isHydrating,
} from './dom/hydration'
import type { VaporComponentInstance } from './component'

export function withAsyncContext(getAwaitable: () => any): [any, () => void] {
  const instance = currentInstance as VaporComponentInstance | null
  if (isHydrating && instance && instance.vapor) {
    const hydrationNode = currentHydrationNode!
    // After `__restore()` brings back the component instance, vapor still needs
    // its own hydration state restored so setup can continue adopting SSR nodes.
    instance.restoreAsyncContext = () => enterHydration(hydrationNode)
  }

  return baseWithAsyncContext(getAwaitable)
}
