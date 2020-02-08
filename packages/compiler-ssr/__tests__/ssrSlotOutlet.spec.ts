import { compile } from '../src'

describe('ssr: <slot>', () => {
  test('basic', () => {
    expect(compile(`<slot/>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _ssrRenderSlot(_ctx.$slots, \\"default\\", {}, null, _push, _parent)
      }"
    `)
  })

  test('with name', () => {
    expect(compile(`<slot name="foo" />`).code).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _ssrRenderSlot(_ctx.$slots, \\"foo\\", {}, null, _push, _parent)
      }"
    `)
  })

  test('with dynamic name', () => {
    expect(compile(`<slot :name="bar.baz" />`).code).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _ssrRenderSlot(_ctx.$slots, _ctx.bar.baz, {}, null, _push, _parent)
      }"
    `)
  })

  test('with props', () => {
    expect(compile(`<slot name="foo" :p="1" bar="2" />`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _ssrRenderSlot(_ctx.$slots, \\"foo\\", {
          p: 1,
          bar: \\"2\\"
        }, null, _push, _parent)
      }"
    `)
  })

  test('with fallback', () => {
    expect(compile(`<slot>some {{ fallback }} content</slot>`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot, ssrInterpolate: _ssrInterpolate } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _ssrRenderSlot(_ctx.$slots, \\"default\\", {}, () => {
          _push(\`some \${_ssrInterpolate(_ctx.fallback)} content\`)
        }, _push, _parent)
      }"
    `)
  })
})
