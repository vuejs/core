import { compile } from '../src'

describe('ssr: attrs fallthrough', () => {
  test('basic', () => {
    expect(compile(`<div/>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require(\\"vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
      }"
    `)
  })

  test('with comments', () => {
    expect(compile(`<!--!--><div/>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require(\\"vue/server-renderer\\")

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

  test('fallthrough component content (root with coomments)', () => {
    expect(compile(`<!--root--><transition><div/></transition>`).code)
      .toMatchInlineSnapshot(`
              "const { ssrRenderAttrs: _ssrRenderAttrs } = require(\\"vue/server-renderer\\")

              return function ssrRender(_ctx, _push, _parent, _attrs) {
                _push(\`<!--[--><!--root--><div\${_ssrRenderAttrs(_attrs)}></div><!--]-->\`)
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
