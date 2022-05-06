import { compile } from '../src'
import { getCompiledString } from './utils'

describe('ssr: text', () => {
  test('static text', () => {
    expect(getCompiledString(`foo`)).toMatchInlineSnapshot(`"\`foo\`"`)
  })

  test('static text with template string special chars', () => {
    expect(getCompiledString(`\`\${foo}\``)).toMatchInlineSnapshot(
      `"\`\\\\\`\\\\\${foo}\\\\\`\`"`
    )
  })

  test('static text with char escape', () => {
    // the desired generated code should be `\\\$foo`
    // snapshot -> inline snapshot goes through two escapes
    // so that makes a total of 3 * 2 * 2 = 12 back slashes
    expect(getCompiledString(`\\$foo`)).toMatchInlineSnapshot(
      `"\`\\\\\\\\\\\\$foo\`"`
    )
  })

  test('comments', () => {
    expect(getCompiledString(`<!--bar-->`)).toMatchInlineSnapshot(
      `"\`<!--bar-->\`"`
    )
  })

  test('static text escape', () => {
    expect(getCompiledString(`&lt;foo&gt;`)).toMatchInlineSnapshot(
      `"\`&lt;foo&gt;\`"`
    )
  })

  test('nested elements with static text', () => {
    expect(
      getCompiledString(`<div><span>hello</span><span>bye</span></div>`)
    ).toMatchInlineSnapshot(
      `"\`<div><span>hello</span><span>bye</span></div>\`"`
    )
  })

  test('interpolation', () => {
    expect(compile(`foo {{ bar }} baz`).code).toMatchInlineSnapshot(`
      "const { ssrInterpolate: _ssrInterpolate } = require(\\"vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`foo \${_ssrInterpolate(_ctx.bar)} baz\`)
      }"
    `)
  })

  test('nested elements with interpolation', () => {
    expect(
      compile(`<div><span>{{ foo }} bar</span><span>baz {{ qux }}</span></div>`)
        .code
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require(\\"vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><span>\${
          _ssrInterpolate(_ctx.foo)
        } bar</span><span>baz \${
          _ssrInterpolate(_ctx.qux)
        }</span></div>\`)
      }"
    `)
  })
})
