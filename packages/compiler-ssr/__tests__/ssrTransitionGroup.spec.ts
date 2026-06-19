import { compile } from '../src'

// transition-group should flatten and concat its children fragments into
// a single one
describe('transition-group', () => {
  test('basic', () => {
    expect(
      compile(`<transition-group><div v-for="i in list"/></transition-group>`)
        .code,
    ).toMatchInlineSnapshot(`
      "const { TransitionGroup: _TransitionGroup, withCtx: _withCtx, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createBlock: _createBlock } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(_ssrRenderComponent(_TransitionGroup, _attrs, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<!--[-->\`)
              _ssrRenderList(_ctx.list, (i) => {
                _push(\`<div\${_scopeId}></div>\`)
              })
              _push(\`<!--]-->\`)
            } else {
              return [
                (_openBlock(true), _createBlock(_Fragment, null, _renderList(_ctx.list, (i) => {
                  return (_openBlock(), _createBlock("div"))
                }), 256 /* UNKEYED_FRAGMENT */))
              ]
            }
          }),
          _: 1 /* STABLE */
        }, _parent))
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
      "const { TransitionGroup: _TransitionGroup, withCtx: _withCtx, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createBlock: _createBlock, createVNode: _createVNode, createCommentVNode: _createCommentVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(_ssrRenderComponent(_TransitionGroup, _attrs, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<!--[-->\`)
              _ssrRenderList(10, (i) => {
                _push(\`<div\${_scopeId}></div>\`)
              })
              _push(\`<!--]--><!--[-->\`)
              _ssrRenderList(10, (i) => {
                _push(\`<div\${_scopeId}></div>\`)
              })
              _push(\`<!--]-->\`)
              if (_ctx.ok) {
                _push(\`<div\${_scopeId}>ok</div>\`)
              } else {
                _push(\`<!---->\`)
              }
            } else {
              return [
                (_openBlock(), _createBlock(_Fragment, null, _renderList(10, (i) => {
                  return _createVNode("div")
                }), 64 /* STABLE_FRAGMENT */)),
                (_openBlock(), _createBlock(_Fragment, null, _renderList(10, (i) => {
                  return _createVNode("div")
                }), 64 /* STABLE_FRAGMENT */)),
                (_ctx.ok)
                  ? (_openBlock(), _createBlock("div", { key: 0 }, "ok"))
                  : _createCommentVNode("v-if", true)
              ]
            }
          }),
          _: 1 /* STABLE */
        }, _parent))
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
