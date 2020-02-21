import { compile } from '../src'

describe('ssr: v-show', () => {
  test('basic', () => {
    expect(compile(`<div v-show="foo"/>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderStyle: _ssrRenderStyle } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div style=\\"\${_ssrRenderStyle((_ctx.foo) ? null : { display: \\"none\\" })}\\"></div>\`)
      }"
    `)
  })

  test('with static style', () => {
    expect(compile(`<div style="color:red" v-show="foo"/>`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderStyle: _ssrRenderStyle } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div style=\\"\${_ssrRenderStyle([
          {\\"color\\":\\"red\\"},
          (_ctx.foo) ? null : { display: \\"none\\" }
        ])}\\"></div>\`)
      }"
    `)
  })

  test('with dynamic style', () => {
    expect(compile(`<div :style="{ color: 'red' }" v-show="foo"/>`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderStyle: _ssrRenderStyle } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div style=\\"\${_ssrRenderStyle([
          { color: 'red' },
          (_ctx.foo) ? null : { display: \\"none\\" }
        ])}\\"></div>\`)
      }"
    `)
  })

  test('with static + dynamic style', () => {
    expect(
      compile(`<div style="color:red" :style="{ fontSize: 14 }" v-show="foo"/>`)
        .code
    ).toMatchInlineSnapshot(`
      "const { ssrRenderStyle: _ssrRenderStyle } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div style=\\"\${_ssrRenderStyle([
          {\\"color\\":\\"red\\"},
          { fontSize: 14 },
          (_ctx.foo) ? null : { display: \\"none\\" }
        ])}\\"></div>\`)
      }"
    `)
  })

  test('with v-bind', () => {
    expect(
      compile(
        `<div v-bind="baz" style="color:red" :style="{ fontSize: 14 }" v-show="foo"/>`
      ).code
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require(\\"vue\\")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_ssrRenderAttrs(_mergeProps(_ctx.baz, {
          style: [
            {\\"color\\":\\"red\\"},
            { fontSize: 14 },
            (_ctx.foo) ? null : { display: \\"none\\" }
          ]
        }))}></div>\`)
      }"
    `)
  })
})
