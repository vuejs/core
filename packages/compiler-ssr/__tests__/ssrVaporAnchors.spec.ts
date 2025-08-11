// import {
//   BLOCK_APPEND_ANCHOR_LABEL,
//   BLOCK_INSERTION_ANCHOR_LABEL,
//   BLOCK_PREPEND_ANCHOR_LABEL,
// } from '@vue/shared'
import { getCompiledString } from './utils'

describe('insertion anchors', () => {
  describe('prepend', () => {
    test('prepend anchor with component', () => {
      expect(
        getCompiledString('<div><Comp/><Comp/><span/></div>', { vapor: true }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--[p-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--p]--><!--[p-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--p]--><span></span></div>\`"
      `)
    })

    test('prepend anchor with component in ssr slot vnode fallback', () => {
      expect(
        getCompiledString(
          `<component :is="'div'">
            <div><Comp/><Comp/><span/></div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--[p-->\`)
                _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
                _push(\`<!--p]--><!--[p-->\`)
                _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
                _push(\`<!--p]--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("[p"),
                    _createVNode(_component_Comp),
                    _createCommentVNode("p]"),
                    _createCommentVNode("[p"),
                    _createVNode(_component_Comp),
                    _createCommentVNode("p]"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })

    test('prepend anchor with slot', () => {
      expect(
        getCompiledString('<div><slot name="foo"/><slot/><span/></div>', {
          vapor: true,
        }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--[p-->\`)
          _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent)
          _push(\`<!--slot--><!--p]--><!--[p-->\`)
          _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent)
          _push(\`<!--slot--><!--p]--><span></span></div>\`"
      `)
    })

    test('prepend anchor with slot in ssr slot vnode fallback', () => {
      expect(
        getCompiledString(
          `<component :is="'div'">
            <div><slot name="foo"/><slot/><span/></div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--[p-->\`)
                _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent, _scopeId)
                _push(\`<!--slot--><!--p]--><!--[p-->\`)
                _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId)
                _push(\`<!--slot--><!--p]--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("[p"),
                    _renderSlot(_ctx.$slots, "foo"),
                    _createCommentVNode("p]"),
                    _createCommentVNode("[p"),
                    _renderSlot(_ctx.$slots, "default"),
                    _createCommentVNode("p]"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 3 /* FORWARDED */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })

    test('prepend anchor with v-if', () => {
      expect(
        getCompiledString('<div><span v-if="foo"/><span/></div>', {
          vapor: true,
        }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--[p-->\`)
          if (_ctx.foo) {
            _push(\`<span></span>\`)
            _push(\`<!--if-->\`)
          } else {
            _push(\`<!---->\`)
          }
          _push(\`<!--p]--><span></span></div>\`"
      `)
    })

    test('prepend anchor with v-if in ssr slot vnode fallback', () => {
      expect(
        getCompiledString(
          `<component :is="'div'">
            <div><span v-if="foo"/><span/></div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--[p-->\`)
                if (_ctx.foo) {
                  _push(\`<span\${_scopeId}></span>\`)
                  _push(\`<!--if-->\`)
                } else {
                  _push(\`<!---->\`)
                }
                _push(\`<!--p]--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("[p"),
                    (_ctx.foo)
                      ? (_openBlock(), _createBlock("span", { key: 0 }))
                      : _createCommentVNode("v-if", true),
                    _createCommentVNode("p]"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })

    test('prepend anchor with v-for', () => {
      expect(
        getCompiledString('<div><span v-for="item in items"/><span/></div>', {
          vapor: true,
        }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--[p--><!--[-->\`)
          _ssrRenderList(_ctx.items, (item) => {
            _push(\`<span></span>\`)
          })
          _push(\`<!--]--><!--for--><!--p]--><span></span></div>\`"
      `)
    })

    test('prepend anchor with v-for in ssr slot vnode fallback', () => {
      expect(
        getCompiledString(
          `<component :is="'div'">
            <div><span v-for="item in items"/><span/></div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--[p--><!--[-->\`)
                _ssrRenderList(_ctx.items, (item) => {
                  _push(\`<span\${_scopeId}></span>\`)
                })
                _push(\`<!--]--><!--for--><!--p]--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("[p"),
                    (_openBlock(true), _createBlock(_Fragment, null, _renderList(_ctx.items, (item) => {
                      return (_openBlock(), _createBlock("span"))
                    }), 256 /* UNKEYED_FRAGMENT */)),
                    _createCommentVNode("p]"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })
  })

  // TODO add more tests
  describe('insertion anchor', () => {
    test('insertion anchor with component', () => {
      expect(
        getCompiledString('<div><span/><Comp/><span/></div>', { vapor: true }),
      ).toMatchInlineSnapshot(`
        "\`<div><span></span><!--[i-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--i]--><span></span></div>\`"
      `)
    })
  })

  // TODO add more tests
  describe('append', () => {
    test('append anchor', () => {
      expect(
        getCompiledString('<div><span/><Comp/><Comp/></div>', { vapor: true }),
      ).toMatchInlineSnapshot(`
        "\`<div><span></span><!--[a-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--a]--><!--[a-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--a]--></div>\`"
      `)
    })
  })

  test('mixed anchors', () => {
    expect(
      getCompiledString('<div><Comp/><span/><Comp/><span/><Comp/></div>', {
        vapor: true,
      }),
    ).toMatchInlineSnapshot(`
      "\`<div><!--[p-->\`)
        _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        _push(\`<!--p]--><span></span><!--[i-->\`)
        _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        _push(\`<!--i]--><span></span><!--[a-->\`)
        _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        _push(\`<!--a]--></div>\`"
    `)
  })

  test('mixed anchors in ssr slot vnode fallback', () => {
    expect(
      getCompiledString(
        `<component :is="'div'"><Comp/><span/><Comp/><span/><Comp/></component>`,
        {
          vapor: true,
        },
      ),
    ).toMatchInlineSnapshot(`
      "\`<!--[a-->\`)
        _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
              _push(\`<span\${_scopeId}></span>\`)
              _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
              _push(\`<span\${_scopeId}></span>\`)
              _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
            } else {
              return [
                _createCommentVNode("[p"),
                _createVNode(_component_Comp),
                _createCommentVNode("p]"),
                _createVNode("span"),
                _createCommentVNode("[i"),
                _createVNode(_component_Comp),
                _createCommentVNode("i]"),
                _createVNode("span"),
                _createCommentVNode("[a"),
                _createVNode(_component_Comp),
                _createCommentVNode("a]")
              ]
            }
          }),
          _: 1 /* STABLE */
        }), _parent)
        _push(\`<!--dynamic-component--><!--a]-->\`"
    `)
  })
})

describe.todo('block anchors', () => {
  test('if', () => {})

  test('if in ssr slot vnode fallback', () => {})

  test('for', () => {})

  test('for in ssr slot vnode fallback', () => {})

  test('slot', () => {})

  test('slot in ssr slot vnode fallback', () => {})

  test('dynamic component', () => {})

  test('dynamic in ssr slot vnode fallback', () => {})
})
