import type { SuspenseBoundary } from '@vue/runtime-dom'

export let isSuspenseEnabled = false
export let parentSuspense: SuspenseBoundary | null = null
// `instance.suspense` is the boundary a component was mounted in, but an
// ancestor boundary may be removed under a different parent Suspense. Carry
// that effective parent through synchronous scope-owned teardown, where VDOM's
// explicit `parentSuspense` argument would otherwise be lost. `undefined`
// means there is no active unmount operation.
export let currentUnmountSuspense: SuspenseBoundary | null | undefined

export function enableSuspense(): void {
  isSuspenseEnabled = true
}

export function withSuspenseEnabled<T>(value: T): T {
  enableSuspense()
  return value
}

export function setParentSuspense(
  suspense: SuspenseBoundary | null,
): SuspenseBoundary | null {
  try {
    return parentSuspense
  } finally {
    parentSuspense = suspense
  }
}

export function setCurrentUnmountSuspense(
  suspense: SuspenseBoundary | null | undefined,
): SuspenseBoundary | null | undefined {
  try {
    return currentUnmountSuspense
  } finally {
    currentUnmountSuspense = suspense
  }
}
