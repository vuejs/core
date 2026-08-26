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

function setCurrentUnmountSuspense(
  suspense: SuspenseBoundary | null | undefined,
): SuspenseBoundary | null | undefined {
  try {
    return currentUnmountSuspense
  } finally {
    currentUnmountSuspense = suspense
  }
}

/**
 * Establishes `suspense` as the active unmount pass's boundary around `fn`.
 * The single entry point for the ambient: unmountComponent and the interop
 * vnode unmount re-enter through this when their explicit argument differs
 * from the active pass.
 */
export function runWithUnmountSuspense<T>(
  suspense: SuspenseBoundary | null,
  fn: () => T,
): T {
  const prev = setCurrentUnmountSuspense(suspense)
  try {
    return fn()
  } finally {
    setCurrentUnmountSuspense(prev)
  }
}

/**
 * The effective boundary for a teardown reached without a parameter channel —
 * scope-disposal callbacks and block removal: the active unmount pass's
 * boundary when one is set, the caller's fallback otherwise.
 */
export function resolveUnmountSuspense(
  fallback: SuspenseBoundary | null,
): SuspenseBoundary | null {
  return currentUnmountSuspense === undefined
    ? fallback
    : currentUnmountSuspense
}
