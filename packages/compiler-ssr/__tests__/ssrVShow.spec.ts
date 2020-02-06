import { compile } from '../src'

describe('ssr: v-show', () => {
  test('basic', () => {
    expect(compile(`<div v-show="foo"/>`).code).toMatchInlineSnapshot(`
      "const { _ssrRenderStyle } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_ssrRenderStyle((_ctx.foo) ? null : { display: \\"none\\" })}></div>\`)
      }"
    `)
  })

  test('with static style', () => {
    expect(compile(`<div style="color:red" v-show="foo"/>`).code)
      .toMatchInlineSnapshot(`
      "const { _ssrRenderStyle } = require(\\"@vue/server-renderer\\")

      const _hoisted_1 = {\\"color\\":\\"red\\"}

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_ssrRenderStyle([
          _hoisted_1,
          (_ctx.foo) ? null : { display: \\"none\\" }
        ])}></div>\`)
      }"
    `)
  })

  test('with dynamic style', () => {
    expect(compile(`<div :style="{ color: 'red' }" v-show="foo"/>`).code)
      .toMatchInlineSnapshot(`
      "const { _ssrRenderStyle } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_ssrRenderStyle([
          { color: 'red' },
          (_ctx.foo) ? null : { display: \\"none\\" }
        ])}></div>\`)
      }"
    `)
  })

  test('with static + dynamic style', () => {
    expect(
      compile(`<div style="color:red" :style="{ fontSize: 14 }" v-show="foo"/>`)
        .code
    ).toMatchInlineSnapshot(`
      "const { _ssrRenderStyle } = require(\\"@vue/server-renderer\\")

      const _hoisted_1 = {\\"color\\":\\"red\\"}

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_ssrRenderStyle([
          _hoisted_1,
          { fontSize: 14 },
          (_ctx.foo) ? null : { display: \\"none\\" }
        ])}></div>\`)
      }"
    `)
  })

  test('with v-bind', () => {
    expect(
      compile(
        `<div v-bind="baz" style="color:red" :style="{ fontSize: 14 }" v-show="foo"/>`
      ).code
    ).toMatchInlineSnapshot(`
      "const { mergeProps } = require(\\"vue\\")
      const { _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      const _hoisted_1 = {\\"color\\":\\"red\\"}

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_ssrRenderAttrs(mergeProps(_ctx.baz, {
          style: [
            _hoisted_1,
            { fontSize: 14 },
            (_ctx.foo) ? null : { display: \\"none\\" }
          ]
        }))}></div>\`)
      }"
    `)
  })
})
