import { createApp, h, Teleport } from 'vue'
import { renderToString } from '../src/renderToString'
import { SSRContext } from '../src/render'
import { ssrRenderTeleport } from '../src/helpers/ssrRenderTeleport'

describe('ssrRenderTeleport', () => {
  test('teleport rendering (compiled)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      createApp({
        data() {
          return { msg: 'hello' }
        },
        ssrRender(_ctx, _push, _parent) {
          ssrRenderTeleport(
            _push,
            _push => {
              _push(`<div>content</div>`)
            },
            '#target',
            false,
            _parent
          )
        }
      }),
      ctx
    )
    expect(html).toBe('<!--teleport start--><!--teleport end-->')
    expect(ctx.teleports!['#target']).toBe(`<div>content</div><!---->`)
  })

  test('teleport rendering (compiled + disabled)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      createApp({
        data() {
          return { msg: 'hello' }
        },
        ssrRender(_ctx, _push, _parent) {
          ssrRenderTeleport(
            _push,
            _push => {
              _push(`<div>content</div>`)
            },
            '#target',
            true,
            _parent
          )
        }
      }),
      ctx
    )
    expect(html).toBe(
      '<!--teleport start--><div>content</div><!--teleport end-->'
    )
    expect(ctx.teleports!['#target']).toBe(`<!---->`)
  })

  test('teleport rendering (vnode)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      h(
        Teleport,
        {
          to: `#target`
        },
        h('span', 'hello')
      ),
      ctx
    )
    expect(html).toBe('<!--teleport start--><!--teleport end-->')
    expect(ctx.teleports!['#target']).toBe('<span>hello</span><!---->')
  })

  test('teleport rendering (vnode + disabled)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      h(
        Teleport,
        {
          to: `#target`,
          disabled: true
        },
        h('span', 'hello')
      ),
      ctx
    )
    expect(html).toBe(
      '<!--teleport start--><span>hello</span><!--teleport end-->'
    )
    expect(ctx.teleports!['#target']).toBe(`<!---->`)
  })

  test('multiple teleports with same target', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      h('div', [
        h(
          Teleport,
          {
            to: `#target`
          },
          h('span', 'hello')
        ),
        h(Teleport, { to: `#target` }, 'world')
      ]),
      ctx
    )
    expect(html).toBe(
      '<div><!--teleport start--><!--teleport end--><!--teleport start--><!--teleport end--></div>'
    )
    expect(ctx.teleports!['#target']).toBe(
      '<span>hello</span><!---->world<!---->'
    )
  })
})
