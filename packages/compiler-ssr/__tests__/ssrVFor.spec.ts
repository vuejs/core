import { compile } from '../src'

describe('ssr: v-for', () => {
  test('basic', () => {
    expect(compile(`<div v-for="i in list" />`).code).toMatchInlineSnapshot(`
      "const { ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        _push(\`<!--]-->\`)
      }"
    `)
  })

  test('nested content', () => {
    expect(compile(`<div v-for="i in list">foo<span>bar</span></div>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<!--[-->\`)
          _ssrRenderList(_ctx.list, (i) => {
            _push(\`<div>foo<span>bar</span></div>\`)
          })
          _push(\`<!--]-->\`)
        }"
      `)
  })

  test('nested v-for', () => {
    expect(
      compile(
        `<div v-for="row, i in list">` +
          `<div v-for="j in row">{{ i }},{{ j }}</div>` +
          `</div>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrInterpolate: _ssrInterpolate, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        _ssrRenderList(_ctx.list, (row, i) => {
          _push(\`<div><!--[-->\`)
          _ssrRenderList(row, (j) => {
            _push(\`<div>\${
              _ssrInterpolate(i)
            },\${
              _ssrInterpolate(j)
            }</div>\`)
          })
          _push(\`<!--]--></div>\`)
        })
        _push(\`<!--]-->\`)
      }"
    `)
  })

  test('template v-for (text)', () => {
    expect(compile(`<template v-for="i in list">{{ i }}</template>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrInterpolate: _ssrInterpolate, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<!--[-->\`)
          _ssrRenderList(_ctx.list, (i) => {
            _push(\`<!--[-->\${_ssrInterpolate(i)}<!--]-->\`)
          })
          _push(\`<!--]-->\`)
        }"
      `)
  })

  test('template v-for (single element)', () => {
    expect(
      compile(`<template v-for="i in list"><span>{{ i }}</span></template>`)
        .code,
    ).toMatchInlineSnapshot(`
      "const { ssrInterpolate: _ssrInterpolate, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<span>\${_ssrInterpolate(i)}</span>\`)
        })
        _push(\`<!--]-->\`)
      }"
    `)
  })

  test('template v-for (multi element)', () => {
    expect(
      compile(
        `<template v-for="i in list"><span>{{ i }}</span><span>{{ i + 1 }}</span></template>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrInterpolate: _ssrInterpolate, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<!--[--><span>\${
            _ssrInterpolate(i)
          }</span><span>\${
            _ssrInterpolate(i + 1)
          }</span><!--]-->\`)
        })
        _push(\`<!--]-->\`)
      }"
    `)
  })

  test('render loop args should not be prefixed', () => {
    const { code } = compile(
      `<div v-for="{ foo }, index in list">{{ foo + bar + index }}</div>`,
    )
    expect(code).toMatch(`_ctx.bar`)
    expect(code).not.toMatch(`_ctx.foo`)
    expect(code).not.toMatch(`_ctx.index`)
    expect(code).toMatchInlineSnapshot(`
      "const { ssrInterpolate: _ssrInterpolate, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        _ssrRenderList(_ctx.list, ({ foo }, index) => {
          _push(\`<div>\${_ssrInterpolate(foo + _ctx.bar + index)}</div>\`)
        })
        _push(\`<!--]-->\`)
      }"
    `)
  })
})
