import { h } from 'vue'
import { renderToString } from '../src'

describe('SSR style declaration blocks', () => {
  test.each(['[red; blue]', '{ red; [blue; green] }'])(
    'preserves custom property blocks in style arrays: %s',
    async value => {
      const html = await renderToString(
        h('div', { style: [`--tokens: ${value}; color: red`] }),
      )
      expect(html).toBe(`<div style="--tokens:${value};color:red;"></div>`)
    },
  )
})
