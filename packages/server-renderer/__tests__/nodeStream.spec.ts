import { createApp, defineAsyncComponent, h } from 'vue'
import { renderToNodeStream, pipeToNodeWritable } from '../src'
import { Writable } from 'node:stream'
import { describe, expect, test } from 'vitest'

describe('Node.js Streams backpressure', () => {
  test('pipeToNodeWritable backpressure', async () => {
    const Async = defineAsyncComponent(() =>
      Promise.resolve({
        render: () => h('div', 'b'),
      }),
    )
    const App = {
      render: () => [h('div', 'a'), h(Async)],
    }

    let writeCount = 0
    const writable = new Writable({
      highWaterMark: 1,
      write(_chunk, _encoding, callback) {
        writeCount++
        callback()
      },
    })

    const originalWrite = writable.write.bind(writable)
    let firstCall = true
    writable.write = (chunk: any, encoding?: any, cb?: any): any => {
      if (firstCall) {
        firstCall = false
        originalWrite(chunk, encoding, cb)
        return false 
      }
      return originalWrite(chunk, encoding, cb)
    }

    pipeToNodeWritable(createApp(App), {}, writable)

    await new Promise(resolve => setTimeout(resolve, 20))
    // Should have only 1 write because it returned false and we're waiting for drain
    expect(writeCount).toBe(1)

    writable.emit('drain')
    await new Promise(resolve => setTimeout(resolve, 20))
    // Second write should have happened after drain
    expect(writeCount).toBeGreaterThan(1)
  })

  test('renderToNodeStream backpressure', async () => {
    const Async = defineAsyncComponent(() =>
      Promise.resolve({
        render: () => h('div', 'b'),
      }),
    )
    const App = {
      render: () => [h('div', 'a'), h(Async)],
    }

    const stream = renderToNodeStream(createApp(App))
    
    // In Node.js Readable, push() returns false when the buffer is full.
    // For our test, we'll just verify that it streams correctly first.
    let res = ''
    for await (const chunk of stream) {
      res += chunk
    }
    expect(res).toBe('<!--[--><div>a</div><div>b</div><!--]-->')
  })
})
