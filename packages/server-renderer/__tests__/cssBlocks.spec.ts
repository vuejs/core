import { h } from 'vue'
import { renderToString } from '../src'

describe('SSR style declaration blocks', () => {
  test.each([
    'url(https://example.com/[)',
    'URL(https://example.com/{)',
    String.raw`u\72l(https://example.com/[)`,
    String.raw`url(https://example.com/a\)b[)`,
  ])('preserves URL tokens in style arrays: %s', async value => {
    const html = await renderToString(
      h('div', { style: [`--tokens: ${value}; color: red`] }),
    )
    expect(html).toBe(`<div style="--tokens:${value};color:red;"></div>`)
  })

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
