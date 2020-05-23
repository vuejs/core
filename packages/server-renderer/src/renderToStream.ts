import {
  App,
  VNode,
  createVNode,
  ssrUtils,
  createApp,
  ssrContextKey
} from 'vue'
import { isString, isPromise } from '@vue/shared'
import {
  createServerRenderer,
  SSRBuffer,
  SSRBufferItem,
  SSRContext,
  BufferInstance
} from './render'
import { Readable } from 'stream'

const { isVNode } = ssrUtils

export function createBuffer(): BufferInstance {
  let appendable = false
  const buffer: SSRBuffer = []
  return {
    getBuffer(): SSRBuffer {
      // Return static buffer and await on items during unroll stage
      return buffer as SSRBuffer
    },
    push(item: SSRBufferItem) {
      const isStringItem = isString(item)
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string
      } else {
        buffer.push(item)
      }
      appendable = isStringItem
    }
  }
}

async function unrollBuffer(
  buffer: SSRBuffer,
  stream: Readable
): Promise<void> {
  for (let item of buffer) {
    if (isPromise(item)) {
      item = await item
    }
    if (isString(item)) {
      stream.push(item)
    } else {
      await unrollBuffer(item, stream)
    }
  }
}

const {
  renderComponentVNode,
  renderComponent,
  renderSlot
} = createServerRenderer(createBuffer)

export { renderComponent, renderSlot }

export function renderToStream(
  input: App | VNode,
  context: SSRContext = {}
): Readable {
  if (isVNode(input)) {
    // raw vnode, wrap with app (for context)
    return renderToStream(createApp({ render: () => input }), context)
  }

  // rendering an app
  const vnode = createVNode(input._component, input._props)
  vnode.appContext = input._context
  // provide the ssr context to the tree
  input.provide(ssrContextKey, context)

  const stream = new Readable()

  Promise.resolve(renderComponentVNode(vnode))
    .then(buffer => unrollBuffer(buffer, stream))
    .then(() => {
      stream.push(null)
    })
    .catch(error => {
      stream.destroy(error)
    })

  return stream
}
