import { createApp, h, Portal } from 'vue'
import { renderToString, SSRContext } from '../src/renderToString'
import { ssrRenderPortal } from '../src/helpers/ssrRenderPortal'

describe('ssrRenderPortal', () => {
  test('portal rendering (compiled)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      createApp({
        data() {
          return { msg: 'hello' }
        },
        ssrRender(_ctx, _push, _parent) {
          ssrRenderPortal(
            _push,
            _push => {
              _push(`<div>content</div>`)
            },
            '#target',
            _parent
          )
        }
      }),
      ctx
    )
    expect(html).toBe('<!--portal-->')
    expect(ctx.portals!['#target']).toBe(`<div>content</div><!---->`)
  })

  test('portal rendering (vnode)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      h(
        Portal,
        {
          target: `#target`
        },
        h('span', 'hello')
      ),
      ctx
    )
    expect(html).toBe('<!--portal-->')
    expect(ctx.portals!['#target']).toBe('<span>hello</span><!---->')
  })

  test('multiple portals with same target', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      h('div', [
        h(
          Portal,
          {
            target: `#target`
          },
          h('span', 'hello')
        ),
        h(Portal, { target: `#target` }, 'world')
      ]),
      ctx
    )
    expect(html).toBe('<div><!--portal--><!--portal--></div>')
    expect(ctx.portals!['#target']).toBe(
      '<span>hello</span><!---->world<!---->'
    )
  })
})
