import {
  App,
  createApp,
  createVNode,
  ssrContextKey,
  ssrUtils,
  VNode
} from 'vue'
import { isArray, isString } from '@vue/shared'
import {
  createServerRenderer,
  SSRBuffer,
  SSRBufferItem,
  SSRContext,
  ResolvedSSRBuffer,
  BufferInstance
} from './render'

const { isVNode } = ssrUtils

// Each component has a buffer array.
// A buffer array can contain one of the following:
// - plain string
// - A resolved buffer (recursive arrays of strings that can be unrolled
//   synchronously)
// - An async buffer (a Promise that resolves to a resolved buffer)
function createBuffer(): BufferInstance {
  let appendable = false
  let hasAsync = false
  const buffer: SSRBuffer = []
  return {
    getBuffer(): ResolvedSSRBuffer | Promise<ResolvedSSRBuffer> {
      // If the current component's buffer contains any Promise from async children,
      // then it must return a Promise too. Otherwise this is a component that
      // contains only sync children so we can avoid the async book-keeping overhead.
      return hasAsync
        ? Promise.all(buffer as ResolvedSSRBuffer)
        : (buffer as ResolvedSSRBuffer)
    },
    push(item: SSRBufferItem) {
      const isStringItem = isString(item)
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string
      } else {
        buffer.push(item)
      }
      appendable = isStringItem
      if (!isStringItem && !isArray(item)) {
        // promise
        hasAsync = true
      }
    }
  }
}

function unrollBuffer(buffer: ResolvedSSRBuffer): string {
  let ret = ''
  for (let i = 0; i < buffer.length; i++) {
    const item = buffer[i]
    if (isString(item)) {
      ret += item
    } else {
      ret += unrollBuffer(item)
    }
  }
  return ret
}

const {
  renderComponentVNode,
  renderComponent,
  renderSlot,
  renderTeleport
} = createServerRenderer(createBuffer)

export { renderComponent, renderSlot, renderTeleport }

export async function renderToString(
  input: App | VNode,
  context: SSRContext = {}
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

  await resolveTeleports(context)

  return unrollBuffer(buffer as ResolvedSSRBuffer)
}

async function resolveTeleports(context: SSRContext) {
  if (context.__teleportBuffers) {
    context.teleports = context.teleports || {}
    for (const key in context.__teleportBuffers) {
      // note: it's OK to await sequentially here because the Promises were
      // created eagerly in parallel.
      context.teleports[key] = unrollBuffer((await Promise.all(
        context.__teleportBuffers[key]
      )) as ResolvedSSRBuffer)
    }
  }
}
