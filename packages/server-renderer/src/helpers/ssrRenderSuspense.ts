import { PushFn, ResolvedSSRBuffer, createBuffer } from '../renderToString'

type ContentRenderFn = (push: PushFn) => void

export async function ssrRenderSuspense({
  default: renderContent,
  fallback: renderFallback
}: Record<string, ContentRenderFn | undefined>): Promise<ResolvedSSRBuffer> {
  try {
    if (renderContent) {
      const { push, getBuffer } = createBuffer()
      push(`<!--[-->`)
      renderContent(push)
      push(`<!--]-->`)
      return await getBuffer()
    } else {
      return []
    }
  } catch {
    if (renderFallback) {
      const { push, getBuffer } = createBuffer()
      push(`<!--[-->`)
      renderFallback(push)
      push(`<!--]-->`)
      return getBuffer()
    } else {
      return []
    }
  }
}
