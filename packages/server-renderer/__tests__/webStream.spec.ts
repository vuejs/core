/**
 * @jest-environment node
 */

import { createApp, h, defineAsyncComponent } from 'vue'
import { ReadableStream } from 'stream/web'
import { renderToWebStream } from '../src'

test('should work', async () => {
  const Async = defineAsyncComponent(() =>
    Promise.resolve({
      render: () => h('div', 'async')
    })
  )
  const App = {
    render: () => [h('div', 'parent'), h(Async)]
  }

  const stream = renderToWebStream(createApp(App), {}, ReadableStream)

  const reader = stream.getReader()

  let res = ''
  await reader.read().then(function read({ done, value }): any {
    if (!done) {
      res += value
      return reader.read().then(read)
    }
  })

  expect(res).toBe(`<!--[--><div>parent</div><div>async</div><!--]-->`)
})
