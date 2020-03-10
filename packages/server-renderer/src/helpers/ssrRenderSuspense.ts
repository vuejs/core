import { PushFn, ResolvedSSRBuffer, createBuffer } from '../renderToString'
import { NOOP } from '@vue/shared'

type ContentRenderFn = (push: PushFn) => void

export async function ssrRenderSuspense({
  default: renderContent = NOOP,
  fallback: renderFallback = NOOP
}: Record<string, ContentRenderFn | undefined>): Promise<ResolvedSSRBuffer> {
  try {
    const { push, getBuffer } = createBuffer()
    renderContent(push)
    return await getBuffer()
  } catch {
    const { push, getBuffer } = createBuffer()
    renderFallback(push)
    return getBuffer()
  }
}
