import {
  type App,
  type VNode,
  createApp,
  createVNode,
  ssrContextKey,
  ssrUtils,
} from '@vue/runtime-dom'
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
  let buffer: SSRBuffer | undefined
  try {
    buffer = await renderComponentVNode(vnode)
    const result = await unrollBuffer(buffer)
    await resolveTeleports(context)
    return result
  } catch (err) {
    settlePendingRender(buffer, context)
    throw err
  } finally {
    stopWatchers(context)
  }
}

export function stopWatchers(context: SSRContext): void {
  if (context.__watcherHandles) {
    for (const unwatch of context.__watcherHandles) {
      unwatch()
    }
  }
}

/**
 * A failed render leaves components after the failure point still in flight,
 * and they can register watchers once the render has settled.
 */
export function settlePendingRender(
  buffer: SSRBuffer | undefined,
  context: SSRContext,
): void {
  ;(async () => {
    if (buffer) await settleBuffer(buffer)
    for (const key in context.__teleportBuffers) {
      await settleBuffer(context.__teleportBuffers[key])
    }
    stopWatchers(context)
  })()
}

async function settleBuffer(buffer: SSRBuffer): Promise<void> {
  if (!buffer.hasAsync) return
  for (let item of buffer) {
    try {
      if (isPromise(item)) item = await item
      if (!isString(item)) await settleBuffer(item)
    } catch {}
  }
}

export async function resolveTeleports(context: SSRContext): Promise<void> {
  if (context.__teleportBuffers) {
    context.teleports = context.teleports || {}
    for (const key in context.__teleportBuffers) {
      // note: it's OK to await sequentially here because the Promises were
      // created eagerly in parallel.
      context.teleports[key] = await unrollBuffer(
        context.__teleportBuffers[key],
      )
    }
  }
}
