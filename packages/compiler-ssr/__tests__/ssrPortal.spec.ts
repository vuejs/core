import { compile } from '../src'

describe('ssr compile: teleport', () => {
  test('should work', () => {
    expect(compile(`<teleport :to="target"><div/></teleport>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderTeleport: _ssrRenderTeleport } = require(\\"vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _ssrRenderTeleport(_push, (_push) => {
            _push(\`<div></div>\`)
          }, _ctx.target, false, _parent)
        }"
      `)
  })

  test('disabled prop handling', () => {
    expect(compile(`<teleport :to="target" disabled><div/></teleport>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderTeleport: _ssrRenderTeleport } = require(\\"vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _ssrRenderTeleport(_push, (_push) => {
            _push(\`<div></div>\`)
          }, _ctx.target, true, _parent)
        }"
      `)

    expect(
      compile(`<teleport :to="target" :disabled="foo"><div/></teleport>`).code
    ).toMatchInlineSnapshot(`
      "const { ssrRenderTeleport: _ssrRenderTeleport } = require(\\"vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderTeleport(_push, (_push) => {
          _push(\`<div></div>\`)
        }, _ctx.target, _ctx.foo, _parent)
      }"
    `)
  })
})
