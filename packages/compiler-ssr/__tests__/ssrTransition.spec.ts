import { compile } from '../src'

describe('transition', () => {
  test('basic', () => {
    expect(compile(`<transition><div>foo</div></transition>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<div\${_ssrRenderAttrs(_attrs)}>foo</div>\`)
        }"
      `)
  })

  test('with appear', () => {
    expect(compile(`<transition appear><div>foo</div></transition>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<template><div\${_ssrRenderAttrs(_attrs)}>foo</div></template>\`)
        }"
      `)
  })
})
