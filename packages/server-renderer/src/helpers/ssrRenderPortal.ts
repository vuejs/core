import { ComponentInternalInstance, ssrContextKey } from 'vue'
import {
  SSRContext,
  createBuffer,
  PushFn,
  SSRBufferItem
} from '../renderToString'

export function ssrRenderPortal(
  parentPush: PushFn,
  contentRenderFn: (push: PushFn) => void,
  target: string,
  disabled: boolean,
  parentComponent: ComponentInternalInstance
) {
  parentPush('<!--portal start-->')

  let portalContent: SSRBufferItem

  if (disabled) {
    contentRenderFn(parentPush)
    portalContent = `<!---->`
  } else {
    const { getBuffer, push } = createBuffer()
    contentRenderFn(push)
    push(`<!---->`) // portal end anchor
    portalContent = getBuffer()
  }

  const context = parentComponent.appContext.provides[
    ssrContextKey as any
  ] as SSRContext
  const portalBuffers =
    context.__portalBuffers || (context.__portalBuffers = {})
  if (portalBuffers[target]) {
    portalBuffers[target].push(portalContent)
  } else {
    portalBuffers[target] = [portalContent]
  }

  parentPush('<!--portal end-->')
}
