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
import { Readable, Writable } from 'stream'

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
    .then(() => stream.push(null))
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
  context: SSRContext = {}
): Readable {
  const stream: Readable = __NODE_JS__
    ? new (require('stream').Readable)()
    : null

  if (!stream) {
    throw new Error(
      `ESM build of renderToStream() does not support renderToNodeStream(). ` +
        `Use pipeToNodeWritable() with an existing Node.js Writable stream ` +
        `instance instead.`
    )
  }

  return renderToSimpleStream(input, context, stream)
}

export function pipeToNodeWritable(
  input: App | VNode,
  context: SSRContext = {},
  writable: Writable
) {
  renderToSimpleStream(input, context, {
    push(content) {
      if (content != null) {
        writable.write(content)
      } else {
        writable.end()
      }
    },
    destroy(err) {
      writable.destroy(err)
    }
  })
}

export function renderToWebStream(
  input: App | VNode,
  context: SSRContext = {}
): ReadableStream {
  if (typeof ReadableStream !== 'function') {
    throw new Error(
      `ReadableStream constructor is not available in the global scope. ` +
        `If the target environment does support web streams, consider using ` +
        `pipeToWebWritable() with an existing WritableStream instance instead.`
    )
  }

  const encoder = new TextEncoder()
  let cancelled = false

  return new ReadableStream({
    start(controller) {
      renderToSimpleStream(input, context, {
        push(content) {
          if (cancelled) return
          if (content != null) {
            controller.enqueue(encoder.encode(content))
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

export function pipeToWebWritable(
  input: App | VNode,
  context: SSRContext = {},
  writable: WritableStream
): void {
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // #4287 CloudFlare workers do not implement `ready` property
  let hasReady = false
  try {
    hasReady = isPromise(writer.ready)
  } catch (e) {}

  renderToSimpleStream(input, context, {
    async push(content) {
      if (hasReady) {
        await writer.ready
      }
      if (content != null) {
        return writer.write(encoder.encode(content))
      } else {
        return writer.close()
      }
    },
    destroy(err) {
      // TODO better error handling?
      console.log(err)
      writer.close()
    }
  })
}
