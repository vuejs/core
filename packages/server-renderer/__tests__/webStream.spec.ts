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

test('pipeToWebWritable backpressure', async () => {
  const Async = defineAsyncComponent(() =>
    Promise.resolve({
      render: () => h('div', 'b'),
    }),
  )
  const App = {
    render: () => [h('div', 'a'), h(Async)],
  }

  let writeCount = 0
  let resolveWrite: any
  const writable = new WritableStream({
    write() {
      writeCount++
      return new Promise(resolve => {
        resolveWrite = resolve
      })
    },
  })

  pipeToWebWritable(createApp(App), {}, writable)

  await new Promise(resolve => setTimeout(resolve, 20))
  // Should have only 1 write because the first one is pending
  expect(writeCount).toBe(1)

  resolveWrite()
  await new Promise(resolve => setTimeout(resolve, 20))
  // Second write should have happened after the async component resolved
  expect(writeCount).toBeGreaterThan(1)
})

test('renderToWebStream backpressure', async () => {
  const Async = defineAsyncComponent(() =>
    Promise.resolve({
      render: () => h('div', 'b'),
    }),
  )
  const App = {
    render: () => [h('div', 'a'), h(Async)],
  }

  const stream = renderToWebStream(createApp(App), {})
  const reader = stream.getReader()

  const { value: v1 } = await reader.read()
  expect(new TextDecoder().decode(v1)).toBe('<!--[--><div>a</div>')

  const { value: v2 } = await reader.read()
  expect(new TextDecoder().decode(v2)).toBe('<div>b</div>')

  const { value: v3 } = await reader.read()
  expect(new TextDecoder().decode(v3)).toBe('<!--]-->')

  const { done } = await reader.read()
  expect(done).toBe(true)
})
