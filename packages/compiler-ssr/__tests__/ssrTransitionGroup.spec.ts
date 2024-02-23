import { compile } from '../src'

// transition-group should flatten and concat its children fragments into
// a single one
describe('transition-group', () => {
  test('basic', () => {
    expect(
      compile(`<transition-group><div v-for="i in list"/></transition-group>`)
        .code,
    ).toMatchInlineSnapshot(`
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

  test('with static tag', () => {
    expect(
      compile(
        `<transition-group tag="ul"><div v-for="i in list"/></transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_attrs)}>\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        _push(\`</ul>\`)
      }"
    `)
  })

  test('with dynamic tag', () => {
    expect(
      compile(
        `<transition-group :tag="someTag"><div v-for="i in list"/></transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<\${
          _ctx.someTag
        }\${
          _ssrRenderAttrs(_attrs)
        }>\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        _push(\`</\${_ctx.someTag}>\`)
      }"
    `)
  })

  test('with multi fragments children', () => {
    expect(
      compile(
        `<transition-group>
              <div v-for="i in 10"/>
              <div v-for="i in 10"/>
              <template v-if="ok"><div>ok</div></template>
            </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        _ssrRenderList(10, (i) => {
          _push(\`<div></div>\`)
        })
        _ssrRenderList(10, (i) => {
          _push(\`<div></div>\`)
        })
        if (_ctx.ok) {
          _push(\`<div>ok</div>\`)
        } else {
          _push(\`<!---->\`)
        }
        _push(\`<!--]-->\`)
      }"
    `)
  })

  test('attribute fallthrough', () => {
    expect(
      compile(
        `<transition-group tag="ul" class="red" id="ok">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_mergeProps({
          class: "red",
          id: "ok"
        }, _attrs))}></ul>\`)
      }"
    `)
  })
})
