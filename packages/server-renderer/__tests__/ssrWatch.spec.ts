import { createSSRApp, defineComponent, h, watch, ref } from 'vue'
import { renderToString } from '../src/renderToString'

describe('ssr: watch', () => {
  // #6013
  test('should work w/ flush:sync', async () => {
    const App = defineComponent(async () => {
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
    const html = await renderToString(app)
    expect(html).toMatch('hello world')
  })
})
