import { ComponentInternalInstance, ssrContextKey } from 'vue'
import { SSRContext, createBuffer, PushFn } from '../renderToString'

export function ssrRenderPortal(
  parentPush: PushFn,
  contentRenderFn: (push: PushFn) => void,
  target: string,
  parentComponent: ComponentInternalInstance
) {
  parentPush('<!--portal-->')
  const { getBuffer, push } = createBuffer()
  contentRenderFn(push)
  push(`<!---->`) // portal end anchor

  const context = parentComponent.appContext.provides[
    ssrContextKey as any
  ] as SSRContext
  const portalBuffers =
    context.__portalBuffers || (context.__portalBuffers = {})
  if (portalBuffers[target]) {
    portalBuffers[target].push(getBuffer())
  } else {
    portalBuffers[target] = [getBuffer()]
  }
}
