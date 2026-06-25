import type { PushFn } from '../render'

// Must remain synchronous: compiled output is `ssrRenderSuspense(_push, ...)`,
// not `_push(ssrRenderSuspense(...))`, so any returned Promise (and its
// rejection) would be silently discarded.
export function ssrRenderSuspense(
  push: PushFn,
  { default: renderContent }: Record<string, (() => void) | undefined>,
): void {
  if (renderContent) {
    renderContent()
  } else {
    push(`<!---->`)
  }
}
