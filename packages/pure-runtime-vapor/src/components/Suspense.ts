import type { SuspenseBoundary } from '@vue/runtime-dom'

export let parentSuspense: SuspenseBoundary | null = null

export function setParentSuspense(
  suspense: SuspenseBoundary | null,
): SuspenseBoundary | null {
  try {
    return parentSuspense
  } finally {
    parentSuspense = suspense
  }
}

// TODO: implement this
export const VaporSuspenseImpl = {
  name: 'VaporSuspense',
  __isSuspense: true,
  process(): void {},
}
