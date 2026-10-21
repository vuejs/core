import { compile } from '../src'

describe('ssr: attrs fallthrough', () => {
  test('basic', () => {
    expect(compile(`<div/>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
      }"
    `)
  })

  test('with comments', () => {
    expect(compile(`<!--!--><div/>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[--><!--!--><div\${_ssrRenderAttrs(_attrs)}></div><!--]-->\`)
      }"
    `)
  })

  // #5140
  test('should not inject to non-single-root if branches', () => {
    expect(compile(`<div v-if="true"/><div/>`).code).toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        if (true) {
          _push(\`<div></div>\`)
        } else {
          _push(\`<!---->\`)
        }
        _push(\`<div></div><!--]-->\`)
      }"
    `)
  })

  test('fallthrough component content (root with comments)', () => {
    expect(compile(`<!--root--><transition><div/></transition>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<!--[--><!--root--><div\${_ssrRenderAttrs(_attrs)}></div><!--]-->\`)
        }"
      `)
  })

  //#8072
  test(`fallthrough component content (with whitespace: 'preserve')`, () => {
    expect(
      compile(
        `
      <a v-if="to">Foo</a>
      <a v-else>Bar</a>
    `,
        {
          whitespace: 'preserve',
        },
      ).code,
    ).toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.to) {
            _push(\`<a\${_ssrRenderAttrs(_attrs)}>Foo</a>\`)
          } else {
            _push(\`<a\${_ssrRenderAttrs(_attrs)}>Bar</a>\`)
          }
        }"
      `)
  })

  // #5933
  test('nested v-if chain in a root <template v-if>', () => {
    expect(
      compile(
        `<template v-if="foo"><div v-if="bar"/><template v-else><p v-if="baz"/><span v-else/></template></template><i v-else/>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          if (_ctx.bar) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          } else {
            if (_ctx.baz) {
              _push(\`<p\${_ssrRenderAttrs(_attrs)}></p>\`)
            } else {
              _push(\`<span\${_ssrRenderAttrs(_attrs)}></span>\`)
            }
          }
        } else {
          _push(\`<i\${_ssrRenderAttrs(_attrs)}></i>\`)
        }
      }"
    `)
  })

  test('sole nested <template v-if> in a root <template v-if>', () => {
    expect(
      compile(
        `<template v-if="foo"><template v-if="bar"><div/></template></template>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          if (_ctx.bar) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          } else {
            _push(\`<!---->\`)
          }
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('v-if branches with comments', () => {
    expect(
      compile(
        `<template v-if="foo"><!--a--><div v-if="bar"/></template>` +
          `<template v-else-if="baz"><!--b--><p/></template>` +
          `<!--c--><span v-else/>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<!--[--><!--a-->\`)
          if (_ctx.bar) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          } else {
            _push(\`<!---->\`)
          }
          _push(\`<!--]-->\`)
        } else if (_ctx.baz) {
          _push(\`<!--[--><!--b--><p\${_ssrRenderAttrs(_attrs)}></p><!--]-->\`)
        } else {
          _push(\`<!--[--><!--c--><span\${_ssrRenderAttrs(_attrs)}></span><!--]-->\`)
        }
      }"
    `)
  })

  test(`v-if branches with comments (with whitespace: 'preserve')`, () => {
    // whitespace next to a comment at the edges of a branch is kept, so the
    // client renders these branches as fragments
    expect(
      compile(
        `<template v-if="foo"><!--a--> <div v-if="bar"/> <span v-else/></template>` +
          `<template v-else><div/> <!--b--></template>`,
        { whitespace: 'preserve' },
      ).code,
    ).toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<!--[--><!--a--> \`)
          if (_ctx.bar) {
            _push(\`<div></div>\`)
          } else {
            _push(\`<span></span>\`)
          }
          _push(\`<!--]-->\`)
        } else {
          _push(\`<!--[--><div></div> <!--b--><!--]-->\`)
        }
      }"
    `)

    // whitespace between v-if/v-else siblings is removed
    expect(
      compile(
        `<template v-if="foo"><div v-if="bar"/> <span v-else/></template>`,
        { whitespace: 'preserve' },
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          if (_ctx.bar) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          } else {
            _push(\`<span\${_ssrRenderAttrs(_attrs)}></span>\`)
          }
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('should not inject to nested v-if chain if not the only content', () => {
    expect(
      compile(`<template v-if="foo"><div v-if="bar"/><p/></template>`).code,
    ).toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<!--[-->\`)
          if (_ctx.bar) {
            _push(\`<div></div>\`)
          } else {
            _push(\`<!---->\`)
          }
          _push(\`<p></p><!--]-->\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('should not inject to fallthrough component content if not root', () => {
    expect(compile(`<div/><transition><div/></transition>`).code)
      .toMatchInlineSnapshot(`
              "
              return function ssrRender(_ctx, _push, _parent, _attrs) {
                _push(\`<!--[--><div></div><div></div><!--]-->\`)
              }"
          `)
  })
})
