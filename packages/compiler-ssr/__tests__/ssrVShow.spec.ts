import { compile } from '../src'

describe('ssr: v-show', () => {
  test('basic', () => {
    expect(compile(`<div v-show="foo"/>`).code).toMatchInlineSnapshot(`
      "const { _renderStyle } = require(\\"vue\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_renderStyle((_ctx.foo) ? null : { display: \\"none\\" })}></div>\`)
      }"
    `)
  })

  test('with static style', () => {
    expect(compile(`<div style="color:red" v-show="foo"/>`).code)
      .toMatchInlineSnapshot(`
      "const { _renderStyle } = require(\\"vue\\")

      const _hoisted_1 = {\\"color\\":\\"red\\"}

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_renderStyle([
          _hoisted_1,
          (_ctx.foo) ? null : { display: \\"none\\" }
        ])}></div>\`)
      }"
    `)
  })

  test('with dynamic style', () => {
    expect(compile(`<div :style="{ color: 'red' }" v-show="foo"/>`).code)
      .toMatchInlineSnapshot(`
      "const { _renderStyle } = require(\\"vue\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_renderStyle([
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
      "const { _renderStyle } = require(\\"vue\\")

      const _hoisted_1 = {\\"color\\":\\"red\\"}

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_renderStyle([
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
      "const { mergeProps, _renderAttrs } = require(\\"vue\\")

      const _hoisted_1 = {\\"color\\":\\"red\\"}

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_renderAttrs(mergeProps(_ctx.baz, {
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
