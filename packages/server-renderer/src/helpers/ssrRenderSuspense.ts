import type { PushFn } from '../render'

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
