import { createSSRApp, defineComponent, h, watch, ref } from 'vue'
import { SSRContext, renderToString } from '../src'

describe('ssr: watch', () => {
  // #6013
  test('should work w/ flush:sync', async () => {
    const App = defineComponent(() => {
      const count = ref(0)
      let msg = ''
      watch(
        count,
        () => {
          msg = 'hello world'
        },
        { flush: 'sync' }
      )
      count.value = 1
      expect(msg).toBe('hello world')
      return () => h('div', null, msg)
    })

    const app = createSSRApp(App)
    const ctx: SSRContext = {}
    const html = await renderToString(app, ctx)

    expect(ctx.__watcherHandles!.length).toBe(1)

    expect(html).toMatch('hello world')
  })
})
