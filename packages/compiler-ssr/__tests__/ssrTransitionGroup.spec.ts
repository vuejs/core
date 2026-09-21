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

  // #11514
  test('with static tag + v-if comment', () => {
    expect(
      compile(
        `<transition-group tag="ul"><div v-for="i in list"/><div v-if="false"></div></transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_attrs)}>\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        if (false) {
          _push(\`<div></div>\`)
        }
        _push(\`</ul>\`)
      }"
    `)
  })

  // #11958
  test('with static tag + comment', () => {
    expect(
      compile(
        `<transition-group tag="ul"><div v-for="i in list"/><!--test--></transition-group>`,
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

  test('with dynamic tag shorthand', () => {
    expect(
      compile(
        `<transition-group :tag><div v-for="i in list"/></transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<\${
          _ctx.tag
        }\${
          _ssrRenderAttrs(_attrs)
        }>\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        _push(\`</\${_ctx.tag}>\`)
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

  // vapor hydration claims ranges by the shape it knows at compile time, so a
  // vapor component keeps every fragment marker; vdom output stays as it is
  describe('in a vapor component', () => {
    const body = (template: string, vapor: boolean) => {
      const { code } = compile(template, { vapor })
      return code.slice(code.indexOf('return function'))
    }

    test.each([
      [
        'v-for',
        `<transition-group tag="ul"><div v-for="i in list"/></transition-group>`,
      ],
      [
        'rows of several nodes',
        `<transition-group tag="ul"><template v-for="i in list"><a/><b/></template></transition-group>`,
      ],
      [
        'a v-if branch of several roots',
        `<transition-group tag="ul"><template v-if="ok"><a/><b/></template></transition-group>`,
      ],
    ])('%s keeps its range', (_, template) => {
      expect(body(template, true)).toContain('<!--[-->')
      expect(body(template, false)).not.toContain('<!--[-->')
    })

    test('output', () => {
      expect(
        body(
          `<transition-group tag="ul"><template v-for="i in list"><a/><b/></template></transition-group>`,
          true,
        ),
      ).toMatchInlineSnapshot(`
        "return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<ul\${_ssrRenderAttrs(_attrs)}><!--[-->\`)
          _ssrRenderList(_ctx.list, (i) => {
            _push(\`<!--[--><a></a><b></b><!--]-->\`)
          })
          _push(\`<!--]--></ul>\`)
        }"
      `)
    })
  })
})
