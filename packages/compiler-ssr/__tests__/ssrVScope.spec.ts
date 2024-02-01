import { compile } from '../src'

describe('ssr: v-scope', () => {
  test('basic', () => {
    expect(compile(`<div v-scope="{ a:1 }">{{a}}</div>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<div\${_ssrRenderAttrs(_attrs)}>\`)
          ;((a = 1) => {
            _push(\`\${_ssrInterpolate(a)}\`)
          })()
          _push(\`</div>\`)
        }"
      `)
  })

  test('nested', () => {
    expect(
      compile(
        `<div v-scope="{ a:1 }">
            <div v-scope="{ b:2 }">{{a}} {{b}}</div>
        </div>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}>\`)
        ;((a = 1) => {
          _push(\`<div>\`)
          ;((b = 2) => {
            _push(\`\${_ssrInterpolate(a)} \${_ssrInterpolate(b)}\`)
          })()
          _push(\`</div>\`)
        })()
        _push(\`</div>\`)
      }"
    `)
  })

  test('ok v-if', () => {
    expect(
      compile(`
      <div v-if="ok" v-scope="{ a:true }" >
        {{ a }}
      </div>
    `).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.ok) {
          _push(\`<div\${_ssrRenderAttrs(_attrs)}>\`)
          ;((a = true) => {
            _push(\`\${_ssrInterpolate(a)}\`)
          })()
          _push(\`</div>\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })
})
