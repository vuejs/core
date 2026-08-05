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

async function populate(reader: ReadableStreamDefaultReader<any>) {
  const decoder = new TextDecoder()

  let res = ''
  await reader.read().then(function read({ done, value }): any {
    if (!done) {
      res += decoder.decode(value)
      return reader.read().then(read)
    }
  })

  return res
}

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

  let res = await populate(reader)

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

  let res = await populate(reader)

  expect(res).toBe(`<!--[--><div>parent</div><div>async</div><!--]-->`)
})

test('pipeToWebWritable destroy passes error to writer.abort', async () => {
  const error = new Error('render failure')
  const App = {
    render: () => {
      throw error
    },
  }

  const abortMock = vi.fn().mockResolvedValue(undefined)
  const closeMock = vi.fn().mockResolvedValue(undefined)
  const writerMock = {
    ready: Promise.resolve(),
    write: vi.fn().mockResolvedValue(undefined),
    close: closeMock,
    abort: abortMock,
  }
  const writableMock = {
    getWriter: () => writerMock,
  } as any

  const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => {})

  pipeToWebWritable(createApp(App), {}, writableMock)

  await new Promise(r => setTimeout(r, 0))

  expect(abortMock).toHaveBeenCalledWith(error)
  expect(closeMock).not.toHaveBeenCalled()

  expect(
    'Unhandled error during execution of render function',
  ).toHaveBeenWarned()

  consoleErrorSpy.mockRestore()
})

test('pipeToWebWritable destroy swallows rejected abort', async () => {
  const error = new Error('render failure')
  const abortError = new Error('abort failed')
  const App = {
    render: () => {
      throw error
    },
  }

  const abortMock = vi.fn().mockRejectedValue(abortError)
  const writerMock = {
    ready: Promise.resolve(),
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    abort: abortMock,
  }
  const writableMock = {
    getWriter: () => writerMock,
  } as any

  const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => {})

  pipeToWebWritable(createApp(App), {}, writableMock)

  await new Promise(r => setTimeout(r, 0))

  expect(abortMock).toHaveBeenCalledWith(error)
  expect(
    'Unhandled error during execution of render function',
  ).toHaveBeenWarned()

  consoleErrorSpy.mockRestore()
})
