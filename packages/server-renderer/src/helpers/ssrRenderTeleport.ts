import { ComponentInternalInstance, ssrContextKey } from 'vue'
import { createBuffer, PushFn, SSRBufferItem, SSRContext } from '../render'

export function ssrRenderTeleport(
  parentPush: PushFn,
  contentRenderFn: (push: PushFn) => void,
  target: string,
  disabled: boolean,
  parentComponent: ComponentInternalInstance
) {
  parentPush('<!--teleport start-->')

  let teleportContent: SSRBufferItem

  if (disabled) {
    contentRenderFn(parentPush)
    teleportContent = `<!---->`
  } else {
    const { getBuffer, push } = createBuffer()
    contentRenderFn(push)
    push(`<!---->`) // teleport end anchor
    teleportContent = getBuffer()
  }

  const context = parentComponent.appContext.provides[
    ssrContextKey as any
  ] as SSRContext
  const teleportBuffers =
    context.__teleportBuffers || (context.__teleportBuffers = {})
  if (teleportBuffers[target]) {
    teleportBuffers[target].push(teleportContent)
  } else {
    teleportBuffers[target] = [teleportContent]
  }

  parentPush('<!--teleport end-->')
}
