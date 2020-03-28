import { compile } from '../src'

describe('ssr compile: portal', () => {
  test('should work', () => {
    expect(compile(`<portal :target="target"><div/></portal>`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderPortal: _ssrRenderPortal } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _ssrRenderPortal(_push, (_push) => {
          _push(\`<div></div>\`)
        }, _ctx.target, _parent)
      }"
    `)
  })
})
