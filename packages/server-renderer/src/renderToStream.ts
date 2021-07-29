import {
  App,
  VNode,
  createVNode,
  ssrUtils,
  createApp,
  ssrContextKey
} from 'vue'
import { isString, isPromise } from '@vue/shared'
import { renderComponentVNode, SSRBuffer, SSRContext } from './render'
import { Readable } from 'stream'

const { isVNode } = ssrUtils

export interface SimpleReadable {
  push(chunk: string | null): void
  destroy(err: any): void
}

async function unrollBuffer(
  buffer: SSRBuffer,
  stream: SimpleReadable
): Promise<void> {
  if (buffer.hasAsync) {
    for (let i = 0; i < buffer.length; i++) {
      let item = buffer[i]
      if (isPromise(item)) {
        item = await item
      }
      if (isString(item)) {
        stream.push(item)
      } else {
        await unrollBuffer(item, stream)
      }
    }
  } else {
    // sync buffer can be more efficiently unrolled without unnecessary await
    // ticks
    unrollBufferSync(buffer, stream)
  }
}

function unrollBufferSync(buffer: SSRBuffer, stream: SimpleReadable) {
  for (let i = 0; i < buffer.length; i++) {
    let item = buffer[i]
    if (isString(item)) {
      stream.push(item)
    } else {
      // since this is a sync buffer, child buffers are never promises
      unrollBufferSync(item as SSRBuffer, stream)
    }
  }
}

export function renderToSimpleStream<T extends SimpleReadable>(
  input: App | VNode,
  context: SSRContext,
  stream: T
): T {
  if (isVNode(input)) {
    // raw vnode, wrap with app (for context)
    return renderToSimpleStream(
      createApp({ render: () => input }),
      context,
      stream
    )
  }

  // rendering an app
  const vnode = createVNode(input._component, input._props)
  vnode.appContext = input._context
  // provide the ssr context to the tree
  input.provide(ssrContextKey, context)

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

/**
 * @deprecated
 */
export function renderToStream(
  input: App | VNode,
  context: SSRContext = {}
): Readable {
  console.warn(
    `[@vue/server-renderer] renderToStream is deprecated - use renderToNodeStream instead.`
  )
  return renderToNodeStream(input, context)
}

export function renderToNodeStream(
  input: App | VNode,
  context: SSRContext = {},
  UserReadable?: typeof Readable
): Readable {
  const stream: Readable = UserReadable
    ? new UserReadable()
    : __NODE_JS__
    ? new (require('stream').Readable)()
    : null

  if (!stream) {
    throw new Error(
      `ESM build of renderToStream() requires explicitly passing in the Node.js ` +
        `Readable constructor the 3rd argument. Example:\n\n` +
        `  import { Readable } from 'stream'\n` +
        `  const stream = renderToStream(app, {}, Readable)`
    )
  }

  return renderToSimpleStream(input, context, stream)
}

const hasGlobalWebStream = typeof ReadableStream === 'function'

export function renderToWebStream(
  input: App | VNode,
  context: SSRContext = {},
  Ctor?: { new (): ReadableStream }
): ReadableStream {
  if (!Ctor && !hasGlobalWebStream) {
    throw new Error(
      `ReadableStream constructor is not avaialbe in the global scope and ` +
        `must be explicitly passed in as the 3rd argument:\n\n` +
        `  import { ReadableStream } from 'stream/web'\n` +
        `  const stream = renderToWebStream(app, {}, ReadableStream)`
    )
  }

  let cancelled = false
  return new (Ctor || ReadableStream)({
    start(controller) {
      renderToSimpleStream(input, context, {
        push(content) {
          if (cancelled) return
          if (content != null) {
            controller.enqueue(content)
          } else {
            controller.close()
          }
        },
        destroy(err) {
          controller.error(err)
        }
      })
    },
    cancel() {
      cancelled = true
    }
  })
}
