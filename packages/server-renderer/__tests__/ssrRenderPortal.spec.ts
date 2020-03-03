import { createApp } from 'vue'
import { renderToString, SSRContext } from '../src/renderToString'
import { ssrRenderPortal } from '../src/helpers/ssrRenderPortal'

describe('ssrRenderPortal', () => {
  test('portal rendering', async () => {
    const ctx = {
      portals: {}
    } as SSRContext
    await renderToString(
      createApp({
        data() {
          return { msg: 'hello' }
        },
        ssrRender(_ctx, _push, _parent) {
          ssrRenderPortal(
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
    expect(ctx.portals!['#target']).toBe(`<div>content</div>`)
  })
})
