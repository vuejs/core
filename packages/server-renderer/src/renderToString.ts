import {
  type App,
  type VNode,
  createApp,
  createVNode,
  ssrContextKey,
  ssrUtils,
} from 'vue'
import { isPromise, isString } from '@vue/shared'
import { type SSRBuffer, type SSRContext, renderComponentVNode } from './render'

const { isVNode } = ssrUtils

function nestedUnrollBuffer(
  buffer: SSRBuffer,
  parentRet: string,
  startIndex: number,
): Promise<string> | string {
  if (!buffer.hasAsync) {
    return parentRet + unrollBufferSync(buffer)
  }

  let ret = parentRet
  for (let i = startIndex; i < buffer.length; i += 1) {
    const item = buffer[i]
    if (isString(item)) {
      ret += item
      continue
    }

    if (isPromise(item)) {
      return item.then(nestedItem => {
        buffer[i] = nestedItem
        return nestedUnrollBuffer(buffer, ret, i)
      })
    }

    const result = nestedUnrollBuffer(item, ret, 0)
    if (isPromise(result)) {
      return result.then(nestedItem => {
        buffer[i] = nestedItem
        return nestedUnrollBuffer(buffer, '', i)
      })
    }

    ret = result
  }

  return ret
}

export function unrollBuffer(buffer: SSRBuffer): Promise<string> | string {
  return nestedUnrollBuffer(buffer, '', 0)
}

function unrollBufferSync(buffer: SSRBuffer): string {
  let ret = ''
  for (let i = 0; i < buffer.length; i++) {
    let item = buffer[i]
    if (isString(item)) {
      ret += item
    } else {
      // since this is a sync buffer, child buffers are never promises
      ret += unrollBufferSync(item as SSRBuffer)
    }
  }
  return ret
}

export async function renderToString(
  input: App | VNode,
  context: SSRContext = {},
): Promise<string> {
  if (isVNode(input)) {
    // raw vnode, wrap with app (for context)
    return renderToString(createApp({ render: () => input }), context)
  }

  // rendering an app
  const vnode = createVNode(input._component, input._props)
  vnode.appContext = input._context
  // provide the ssr context to the tree
  input.provide(ssrContextKey, context)
  const buffer = await renderComponentVNode(vnode)

  const result = await unrollBuffer(buffer as SSRBuffer)

  await resolveTeleports(context)

  if (context.__watcherHandles) {
    for (const unwatch of context.__watcherHandles) {
      unwatch()
    }
  }

  return result
}

export async function resolveTeleports(context: SSRContext): Promise<void> {
  if (context.__teleportBuffers) {
    context.teleports = context.teleports || {}
    for (const key in context.__teleportBuffers) {
      // note: it's OK to await sequentially here because the Promises were
      // created eagerly in parallel.
      context.teleports[key] = await unrollBuffer(
        await Promise.all([context.__teleportBuffers[key]]),
      )
    }
  }
}
