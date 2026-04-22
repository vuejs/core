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
import type { Readable, Writable } from 'node:stream'
import { resolveTeleports } from './renderToString'

const { isVNode } = ssrUtils

function waitDrain(stream: Writable): Promise<void> {
  return new Promise(resolve => {
    stream.once('drain', resolve)
  })
}

export interface SimpleReadable {
  push(chunk: string | null): void | Promise<void>
  destroy(err: any): void
}

async function unrollBuffer(
  buffer: SSRBuffer,
  stream: SimpleReadable,
): Promise<void> {
  if (buffer.hasAsync) {
    for (let i = 0; i < buffer.length; i++) {
      let item = buffer[i]
      if (isPromise(item)) {
        item = await item
      }
      if (isString(item)) {
        const res = stream.push(item)
        if (isPromise(res)) await res
      } else {
        await unrollBuffer(item, stream)
      }
    }
  } else {
    const res = unrollBufferSync(buffer, stream)
    if (isPromise(res)) await res
  }
}

function unrollBufferSync(
  buffer: SSRBuffer,
  stream: SimpleReadable,
): void | Promise<void> {
  for (let i = 0; i < buffer.length; i++) {
    let item = buffer[i]
    if (isString(item)) {
      const res = stream.push(item)
      if (isPromise(res)) {
        // if the stream is async, we can't unroll it syncly anymore
        // this can happen if a sync buffer is being pushed to an async stream
        return res.then(() => unrollBufferSync(buffer.slice(i + 1), stream))
      }
    } else {
      // since this is a sync buffer, child buffers are never promises
      const res = unrollBufferSync(item as SSRBuffer, stream)
      if (isPromise(res)) {
        return res.then(() => unrollBufferSync(buffer.slice(i + 1), stream))
      }
    }
  }
}

export function renderToSimpleStream<T extends SimpleReadable>(
  input: App | VNode,
  context: SSRContext,
  stream: T,
): T {
  if (isVNode(input)) {
    // raw vnode, wrap with app (for context)
    return renderToSimpleStream(
      createApp({ render: () => input }),
      context,
      stream,
    )
  }

  // rendering an app
  const vnode = createVNode(input._component, input._props)
  vnode.appContext = input._context
  // provide the ssr context to the tree
  input.provide(ssrContextKey, context)

  Promise.resolve()
    .then(() => renderComponentVNode(vnode))
    .then(buffer => unrollBuffer(buffer, stream))
    .then(() => resolveTeleports(context))
    .then(() => {
      if (context.__watcherHandles) {
        for (const unwatch of context.__watcherHandles) {
          unwatch()
        }
      }
    })
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
  context: SSRContext = {},
): Readable {
  console.warn(
    `[@vue/server-renderer] renderToStream is deprecated - use renderToNodeStream instead.`,
  )
  return renderToNodeStream(input, context)
}

export function renderToNodeStream(
  input: App | VNode,
  context: SSRContext = {},
): Readable {
  let resolveRead: (() => void) | null = null
  const stream: Readable = __CJS__
    ? new (require('node:stream').Readable)({
        read() {
          if (resolveRead) {
            resolveRead()
            resolveRead = null
          }
        },
      })
    : null

  if (!stream) {
    throw new Error(
      `ESM build of renderToStream() does not support renderToNodeStream(). ` +
        `Use pipeToNodeWritable() with an existing Node.js Writable stream ` +
        `instance instead.`,
    )
  }

  renderToSimpleStream(input, context, {
    push(content) {
      if (content != null) {
        if (!stream.push(content)) {
          return new Promise<void>(resolve => {
            resolveRead = resolve
          })
        }
      } else {
        stream.push(null)
      }
    },
    destroy(err) {
      stream.destroy(err)
    },
  } as any)

  return stream
}

export function pipeToNodeWritable(
  input: App | VNode,
  context: SSRContext | undefined = {},
  writable: Writable,
): void {
  renderToSimpleStream(input, context, {
    async push(content) {
      if (content != null) {
        if (!writable.write(content)) {
          await waitDrain(writable)
        }
      } else {
        writable.end()
      }
    },
    destroy(err) {
      writable.destroy(err)
    },
  })
}

export function renderToWebStream(
  input: App | VNode,
  context: SSRContext = {},
): ReadableStream {
  if (typeof ReadableStream !== 'function') {
    throw new Error(
      `ReadableStream constructor is not available in the global scope. ` +
        `If the target environment does support web streams, consider using ` +
        `pipeToWebWritable() with an existing WritableStream instance instead.`,
    )
  }

  const encoder = new TextEncoder()
  let cancelled = false
  let resolvePull: (() => void) | null = null

  return new ReadableStream({
    start(controller) {
      renderToSimpleStream(input, context, {
        async push(content) {
          if (cancelled) return
          if (content != null) {
            controller.enqueue(encoder.encode(content))
            if (controller.desiredSize! <= 0) {
              return new Promise(resolve => {
                resolvePull = resolve
              })
            }
          } else {
            controller.close()
          }
        },
        destroy(err) {
          controller.error(err)
        },
      })
    },
    pull() {
      if (resolvePull) {
        resolvePull()
        resolvePull = null
      }
    },
    cancel() {
      cancelled = true
      if (resolvePull) {
        resolvePull()
        resolvePull = null
      }
    },
  })
}

export function pipeToWebWritable(
  input: App | VNode,
  context: SSRContext | undefined = {},
  writable: WritableStream,
): void {
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // #4287 CloudFlare workers do not implement `ready` property
  let hasReady = false
  try {
    hasReady = isPromise(writer.ready)
  } catch (e: any) {}

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
      writer.abort(err).catch(() => {
        // ignore errors from aborting an already closed/errored stream
      })
    },
  })
}
