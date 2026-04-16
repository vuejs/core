import { createApp, defineAsyncComponent, h } from 'vue'
import { ReadableStream, TransformStream } from 'node:stream/web'
import { pipeToWebWritable, renderToWebStream } from '../src'

beforeEach(() => {
  // @ts-expect-error
  global.ReadableStream = ReadableStream
})

afterEach(() => {
  // @ts-expect-error
  delete global.ReadableStream
})

test('renderToWebStream', async () => {
  const Async = defineAsyncComponent(() =>
    Promise.resolve({
      render: () => h('div', 'async'),
    }),
  )
  const App = {
    render: () => [h('div', 'parent'), h(Async)],
  }

  const stream = renderToWebStream(createApp(App))

  const reader = stream.getReader()
  const decoder = new TextDecoder()

  let res = ''
  await reader.read().then(function read({ done, value }): any {
    if (!done) {
      res += decoder.decode(value)
      return reader.read().then(read)
    }
  })

  expect(res).toBe(`<!--[--><div>parent</div><div>async</div><!--]-->`)
})

test('pipeToWebWritable', async () => {
  const Async = defineAsyncComponent(() =>
    Promise.resolve({
      render: () => h('div', 'async'),
    }),
  )
  const App = {
    render: () => [h('div', 'parent'), h(Async)],
  }

  const { readable, writable } = new TransformStream()
  pipeToWebWritable(createApp(App), {}, writable as any)

  const reader = readable.getReader()
  const decoder = new TextDecoder()

  let res = ''
  await reader.read().then(function read({ done, value }): any {
    if (!done) {
      res += decoder.decode(value)
      return reader.read().then(read)
    }
  })

  expect(res).toBe(`<!--[--><div>parent</div><div>async</div><!--]-->`)
})

test('pipeToWebWritable error handling', async () => {
  const App = {
    ssrRender() {
      throw new Error('ssr render error')
    },
  }

  let abortedReason: any
  const writable = new WritableStream({
    abort(reason) {
      abortedReason = reason
    },
  })

  pipeToWebWritable(createApp(App), {}, writable)

  // Wait for the error to propagate
  await new Promise(resolve => setTimeout(resolve, 10))

  expect(abortedReason).toBeInstanceOf(Error)
  expect(abortedReason.message).toBe('ssr render error')
})
