import { compile } from '../src'

describe('ssr: v-model', () => {
  test('<input> (text types)', () => {
    expect(compile(`<input v-model="bar">`).code).toMatchInlineSnapshot(`
      "const { _renderAttr } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input\${_renderAttr(\\"value\\", _ctx.bar)}>\`)
      }"
    `)

    expect(compile(`<input type="email" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { _renderAttr } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input type=\\"email\\"\${_renderAttr(\\"value\\", _ctx.bar)}>\`)
      }"
    `)
  })

  test('<input type="radio">', () => {
    expect(compile(`<input type="radio" value="foo" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { _looseEqual } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input type=\\"radio\\" value=\\"foo\\"\${(_looseEqual(_ctx.bar, \\"foo\\")) ? \\" checked\\" : \\"\\"}>\`)
      }"
    `)
  })

  test('<input type="checkbox"', () => {
    expect(compile(`<input type="checkbox" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { _looseContain } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input type=\\"checkbox\\"\${((Array.isArray(_ctx.bar))
          ? _looseContain(_ctx.bar, null)
          : _ctx.bar) ? \\" checked\\" : \\"\\"}>\`)
      }"
    `)

    expect(compile(`<input type="checkbox" value="foo" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { _looseContain } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input type=\\"checkbox\\" value=\\"foo\\"\${((Array.isArray(_ctx.bar))
          ? _looseContain(_ctx.bar, \\"foo\\")
          : _ctx.bar) ? \\" checked\\" : \\"\\"}>\`)
      }"
    `)
  })

  test('<textarea>', () => {
    expect(compile(`<textarea v-model="foo">bar</textarea>`).code)
      .toMatchInlineSnapshot(`
      "const { _interpolate } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<textarea>\${_interpolate(_ctx.foo)}</textarea>\`)
      }"
    `)
  })
})
