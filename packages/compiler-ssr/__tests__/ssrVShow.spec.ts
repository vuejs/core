import { compile } from '../src'

function compileWithWrapper(src: string) {
  return compile(`<div>${src}</div>`)
}

describe('ssr: v-show', () => {
  test('basic as root', () => {
    expect(compile(`<div v-show="foo"/>`).code).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_mergeProps({
          style: (_ctx.foo) ? null : { display: "none" }
        }, _attrs))}></div>\`)
      }"
    `)
  })

  test('basic', () => {
    expect(compileWithWrapper(`<div v-show="foo"/>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderStyle: _ssrRenderStyle, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<div\${
            _ssrRenderAttrs(_attrs)
          }><div style="\${
            _ssrRenderStyle((_ctx.foo) ? null : { display: "none" })
          }"></div></div>\`)
        }"
      `)
  })

  test('with static style', () => {
    expect(compileWithWrapper(`<div style="color:red" v-show="foo"/>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderStyle: _ssrRenderStyle, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<div\${
            _ssrRenderAttrs(_attrs)
          }><div style="\${
            _ssrRenderStyle([
              {"color":"red"},
              (_ctx.foo) ? null : { display: "none" }
            ])
          }"></div></div>\`)
        }"
      `)
  })

  test('with dynamic style', () => {
    expect(
      compileWithWrapper(`<div :style="{ color: 'red' }" v-show="foo"/>`).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderStyle: _ssrRenderStyle, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><div style="\${
          _ssrRenderStyle([
            { color: 'red' },
            (_ctx.foo) ? null : { display: "none" }
          ])
        }"></div></div>\`)
      }"
    `)
  })

  test('with static + dynamic style', () => {
    expect(
      compileWithWrapper(
        `<div style="color:red" :style="{ fontSize: 14 }" v-show="foo"/>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderStyle: _ssrRenderStyle, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><div style="\${
          _ssrRenderStyle([
            {"color":"red"},
            { fontSize: 14 },
            (_ctx.foo) ? null : { display: "none" }
          ])
        }"></div></div>\`)
      }"
    `)
  })

  test('with v-bind', () => {
    expect(
      compileWithWrapper(
        `<div v-bind="baz" style="color:red" :style="{ fontSize: 14 }" v-show="foo"/>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><div\${
          _ssrRenderAttrs(_mergeProps(_ctx.baz, {
            style: [
              {"color":"red"},
              { fontSize: 14 },
              (_ctx.foo) ? null : { display: "none" }
            ]
          }))
        }></div></div>\`)
      }"
    `)
  })
})
