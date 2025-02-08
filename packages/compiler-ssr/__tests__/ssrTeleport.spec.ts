import { compile } from '../src'

describe('teleport', () => {
  test('with static to', () => {
    expect(compile(`<teleport to="body"><div></div></teleport>`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderTeleport: _ssrRenderTeleport } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderTeleport(_push, (_push) => {
          _push(\`<div></div>\`)
        }, "body", false, _parent)
      }"
    `)
  })

  test('with dynamic to', () => {
    expect(compile(`<teleport :to="target"><div></div></teleport>`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderTeleport: _ssrRenderTeleport } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderTeleport(_push, (_push) => {
          _push(\`<div></div>\`)
        }, _ctx.target, false, _parent)
      }"
    `)
  })

  test('with dynamic to shorthand', () => {
    expect(compile(`<teleport :to><div></div></teleport>`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderTeleport: _ssrRenderTeleport } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderTeleport(_push, (_push) => {
          _push(\`<div></div>\`)
        }, _ctx.to, false, _parent)
      }"
    `)
  })
})
