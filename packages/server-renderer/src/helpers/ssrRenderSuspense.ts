import { PushFn } from '../render'

export async function ssrRenderSuspense(
  push: PushFn,
  { default: renderContent }: Record<string, (() => void) | undefined>
) {
  if (renderContent) {
    push(`<!--[-->`)
    renderContent()
    push(`<!--]-->`)
  } else {
    push(`<!---->`)
  }
}
