import type { SuspenseBoundary } from '@vue/runtime-dom'

export let isSuspenseEnabled = false
export let parentSuspense: SuspenseBoundary | null = null

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
