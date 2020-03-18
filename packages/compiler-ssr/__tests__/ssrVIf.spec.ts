import { compile } from '../src'

describe('ssr: v-if', () => {
  test('basic', () => {
    expect(compile(`<div v-if="foo"></div>`).code).toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<div></div>\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('with nested content', () => {
    expect(compile(`<div v-if="foo">hello<span>ok</span></div>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<div>hello<span>ok</span></div>\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('v-if + v-else', () => {
    expect(compile(`<div v-if="foo"/><span v-else/>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<div></div>\`)
        } else {
          _push(\`<span></span>\`)
        }
      }"
    `)
  })

  test('v-if + v-else-if', () => {
    expect(compile(`<div v-if="foo"/><span v-else-if="bar"/>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<div></div>\`)
        } else if (_ctx.bar) {
          _push(\`<span></span>\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('v-if + v-else-if + v-else', () => {
    expect(compile(`<div v-if="foo"/><span v-else-if="bar"/><p v-else/>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<div></div>\`)
        } else if (_ctx.bar) {
          _push(\`<span></span>\`)
        } else {
          _push(\`<p></p>\`)
        }
      }"
    `)
  })

  test('<template v-if> (text)', () => {
    expect(compile(`<template v-if="foo">hello</template>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<!--[-->hello<!--]-->\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('<template v-if> (single element)', () => {
    // single element should not wrap with fragment
    expect(compile(`<template v-if="foo"><div>hi</div></template>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<div>hi</div>\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('<template v-if> (multiple element)', () => {
    expect(
      compile(`<template v-if="foo"><div>hi</div><div>ho</div></template>`).code
    ).toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<!--[--><div>hi</div><div>ho</div><!--]-->\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('<template v-if> (with v-for inside)', () => {
    expect(
      compile(`<template v-if="foo"><div v-for="i in list"/></template>`).code
    ).toMatchInlineSnapshot(`
      "const { ssrRenderList: _ssrRenderList } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<!--[-->\`)
          _ssrRenderList(_ctx.list, (i) => {
            _push(\`<div></div>\`)
          })
          _push(\`<!--]-->\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('<template v-if> + normal v-else', () => {
    expect(
      compile(
        `<template v-if="foo"><div>hi</div><div>ho</div></template><div v-else/>`
      ).code
    ).toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        if (_ctx.foo) {
          _push(\`<!--[--><div>hi</div><div>ho</div><!--]-->\`)
        } else {
          _push(\`<div></div>\`)
        }
      }"
    `)
  })
})
