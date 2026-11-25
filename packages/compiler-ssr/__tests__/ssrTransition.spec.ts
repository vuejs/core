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

  // vdom renders the nodes of a branch bare; a vapor branch keeps the range
  // it has anywhere else
  test('branch with several nodes', () => {
    const template = `<transition>
        <template v-if="ok"><!--c--><div/></template>
      </transition>`
    expect(compile(template, { comments: true }).code).toContain(
      '`<!--c--><div></div>`',
    )
    expect(compile(template, { comments: true, vapor: true }).code).toContain(
      '`<!--[--><!--c--><div></div><!--]-->`',
    )
  })
})
