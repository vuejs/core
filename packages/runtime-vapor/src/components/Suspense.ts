import type { SuspenseBoundary } from '@vue/runtime-dom'

export let parentSuspense: SuspenseBoundary | null = null
export function setParentSuspense(suspense: SuspenseBoundary | null): void {
  parentSuspense = suspense
}

// TODO
export const VaporSuspenseImpl = {
  name: 'VaporSuspense',
  __isSuspense: true,
  process(): void {},
}
