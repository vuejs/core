import { ComponentInternalInstance, ssrContextKey } from 'vue'
import { SSRContext, createBuffer, PushFn } from '../renderToString'

export function ssrRenderPortal(
  contentRenderFn: (push: PushFn) => void,
  target: string,
  parentComponent: ComponentInternalInstance
) {
  const { getBuffer, push } = createBuffer()

  contentRenderFn(push)

  const context = parentComponent.appContext.provides[
    ssrContextKey as any
  ] as SSRContext
  const portalBuffers =
    context.__portalBuffers || (context.__portalBuffers = {})

  portalBuffers[target] = getBuffer()
}
