import type { PushFn } from '../render'

export async function ssrRenderSuspense(
  push: PushFn,
  { default: renderContent }: Record<string, (() => void) | undefined>,
): Promise<void> {
  if (renderContent) {
    renderContent()
  } else {
    push(`<!---->`)
  }
}
