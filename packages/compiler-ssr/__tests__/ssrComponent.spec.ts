import { compile } from '../src'

describe('ssr: components', () => {
  test('basic', () => {
    expect(compile(`<foo id="a" :prop="b" />`).code).toMatchInlineSnapshot(`
      "const { resolveComponent } = require(\\"vue\\")
      const { _renderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        const _component_foo = resolveComponent(\\"foo\\")

        _renderComponent(_component_foo, {
          id: \\"a\\",
          prop: _ctx.b
        }, null, _parent)
      }"
    `)
  })

  test('dynamic component', () => {
    expect(compile(`<component is="foo" prop="b" />`).code)
      .toMatchInlineSnapshot(`
      "const { resolveComponent } = require(\\"vue\\")
      const { _renderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        const _component_foo = resolveComponent(\\"foo\\")

        _renderComponent(_component_foo, { prop: \\"b\\" }, null, _parent)
      }"
    `)

    expect(compile(`<compoonent :is="foo" prop="b" />`).code)
      .toMatchInlineSnapshot(`
      "const { resolveComponent } = require(\\"vue\\")
      const { _renderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        const _component_compoonent = resolveComponent(\\"compoonent\\")

        _renderComponent(_component_compoonent, {
          is: _ctx.foo,
          prop: \\"b\\"
        }, null, _parent)
      }"
    `)
  })
})
