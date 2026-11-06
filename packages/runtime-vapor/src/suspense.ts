import type { SuspenseBoundary } from '@vue/runtime-dom'
import type { VaporFragment } from './fragment'

export let isSuspenseEnabled = false
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

export type DeferredEnterTarget = Element | VaporFragment

// What vapor mounted under a boundary while it was pending, for its reveal to
// enter: elements whose enter the boundary held back, and the vdom content
// nested in vapor elements (the boundary's own walk stops at a vapor
// component). Keyed by the container the pending branch sits in: a replaced
// branch takes its container, and these entries, with it. A set: a mounted
// block re-inserted while pending registers again. Drained on the reveal.
const deferredEnters: WeakMap<
  ParentNode,
  Set<DeferredEnterTarget>
> = new WeakMap()

export function deferEnter(
  suspense: SuspenseBoundary,
  target: DeferredEnterTarget,
): void {
  const container = suspense.hiddenContainer as ParentNode
  const targets = deferredEnters.get(container)
  if (targets) {
    targets.add(target)
  } else {
    deferredEnters.set(container, new Set([target]))
  }
}

export function takeDeferredEnters(
  suspense: SuspenseBoundary,
): Set<DeferredEnterTarget> | undefined {
  const container = suspense.hiddenContainer as ParentNode
  const targets = deferredEnters.get(container)
  if (targets) deferredEnters.delete(container)
  return targets
}
