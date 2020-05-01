import { compile } from '../src'

describe('ssr: components', () => {
  test('basic', () => {
    expect(compile(`<foo id="a" :prop="b" />`).code).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent } = require(\\"vue\\")
      const { ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        const _component_foo = _resolveComponent(\\"foo\\")

        _push(_ssrRenderComponent(_component_foo, {
          id: \\"a\\",
          prop: _ctx.b
        }, null, _parent))
      }"
    `)
  })

  test('dynamic component', () => {
    expect(compile(`<component is="foo" prop="b" />`).code)
      .toMatchInlineSnapshot(`
      "const { resolveDynamicComponent: _resolveDynamicComponent } = require(\\"vue\\")
      const { ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(_ssrRenderComponent(_resolveDynamicComponent(\\"foo\\"), { prop: \\"b\\" }, null, _parent))
      }"
    `)

    expect(compile(`<component :is="foo" prop="b" />`).code)
      .toMatchInlineSnapshot(`
      "const { resolveDynamicComponent: _resolveDynamicComponent } = require(\\"vue\\")
      const { ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(_ssrRenderComponent(_resolveDynamicComponent(_ctx.foo), { prop: \\"b\\" }, null, _parent))
      }"
    `)
  })

  describe('slots', () => {
    test('implicit default slot', () => {
      expect(compile(`<foo>hello<div/></foo>`).code).toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent, withCtx: _withCtx, createVNode: _createVNode, createTextVNode: _createTextVNode } = require(\\"vue\\")
        const { ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent) {
          const _component_foo = _resolveComponent(\\"foo\\")

          _push(_ssrRenderComponent(_component_foo, null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`hello<div\${_scopeId}></div>\`)
              } else {
                return [
                  _createTextVNode(\\"hello\\"),
                  _createVNode(\\"div\\")
                ]
              }
            }),
            _: 1
          }, _parent))
        }"
      `)
    })

    test('explicit default slot', () => {
      expect(compile(`<foo v-slot="{ msg }">{{ msg + outer }}</foo>`).code)
        .toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent, withCtx: _withCtx, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode } = require(\\"vue\\")
        const { ssrRenderComponent: _ssrRenderComponent, ssrInterpolate: _ssrInterpolate } = require(\\"@vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent) {
          const _component_foo = _resolveComponent(\\"foo\\")

          _push(_ssrRenderComponent(_component_foo, null, {
            default: _withCtx(({ msg }, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`\${_ssrInterpolate(msg + _ctx.outer)}\`)
              } else {
                return [
                  _createTextVNode(_toDisplayString(msg + _ctx.outer), 1 /* TEXT */)
                ]
              }
            }),
            _: 1
          }, _parent))
        }"
      `)
    })

    test('named slots', () => {
      expect(
        compile(`<foo>
        <template v-slot>foo</template>
        <template v-slot:named>bar</template>
      </foo>`).code
      ).toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent, withCtx: _withCtx, createTextVNode: _createTextVNode } = require(\\"vue\\")
        const { ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent) {
          const _component_foo = _resolveComponent(\\"foo\\")

          _push(_ssrRenderComponent(_component_foo, null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`foo\`)
              } else {
                return [
                  _createTextVNode(\\"foo\\")
                ]
              }
            }),
            named: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`bar\`)
              } else {
                return [
                  _createTextVNode(\\"bar\\")
                ]
              }
            }),
            _: 1
          }, _parent))
        }"
      `)
    })

    test('v-if slot', () => {
      expect(
        compile(`<foo>
        <template v-slot:named v-if="ok">foo</template>
      </foo>`).code
      ).toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent, withCtx: _withCtx, createTextVNode: _createTextVNode, createSlots: _createSlots } = require(\\"vue\\")
        const { ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent) {
          const _component_foo = _resolveComponent(\\"foo\\")

          _push(_ssrRenderComponent(_component_foo, null, _createSlots({ _: 1 }, [
            (_ctx.ok)
              ? {
                  name: \\"named\\",
                  fn: _withCtx((_, _push, _parent, _scopeId) => {
                    if (_push) {
                      _push(\`foo\`)
                    } else {
                      return [
                        _createTextVNode(\\"foo\\")
                      ]
                    }
                  })
                }
              : undefined
          ]), _parent))
        }"
      `)
    })

    test('v-for slot', () => {
      expect(
        compile(`<foo>
        <template v-for="key in names" v-slot:[key]="{ msg }">{{ msg + key + bar }}</template>
      </foo>`).code
      ).toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent, withCtx: _withCtx, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, renderList: _renderList, createSlots: _createSlots } = require(\\"vue\\")
        const { ssrRenderComponent: _ssrRenderComponent, ssrInterpolate: _ssrInterpolate } = require(\\"@vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent) {
          const _component_foo = _resolveComponent(\\"foo\\")

          _push(_ssrRenderComponent(_component_foo, null, _createSlots({ _: 1 }, [
            _renderList(_ctx.names, (key) => {
              return {
                name: key,
                fn: _withCtx(({ msg }, _push, _parent, _scopeId) => {
                  if (_push) {
                    _push(\`\${_ssrInterpolate(msg + key + _ctx.bar)}\`)
                  } else {
                    return [
                      _createTextVNode(_toDisplayString(msg + _ctx.key + _ctx.bar), 1 /* TEXT */)
                    ]
                  }
                })
              }
            })
          ]), _parent))
        }"
      `)
    })

    test('nested transform scoping in vnode branch', () => {
      expect(
        compile(`<foo>
        <template v-slot:foo="{ list }">
          <div v-if="ok">
            <span v-for="i in list"></span>
          </div>
        </template>
        <template v-slot:bar="{ ok }">
          <div v-if="ok">
            <span v-for="i in list"></span>
          </div>
        </template>
      </foo>`).code
      ).toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent, withCtx: _withCtx, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createBlock: _createBlock, createVNode: _createVNode, createCommentVNode: _createCommentVNode } = require(\\"vue\\")
        const { ssrRenderComponent: _ssrRenderComponent, ssrRenderList: _ssrRenderList } = require(\\"@vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent) {
          const _component_foo = _resolveComponent(\\"foo\\")

          _push(_ssrRenderComponent(_component_foo, null, {
            foo: _withCtx(({ list }, _push, _parent, _scopeId) => {
              if (_push) {
                if (_ctx.ok) {
                  _push(\`<div\${_scopeId}><!--[-->\`)
                  _ssrRenderList(list, (i) => {
                    _push(\`<span\${_scopeId}></span>\`)
                  })
                  _push(\`<!--]--></div>\`)
                } else {
                  _push(\`<!---->\`)
                }
              } else {
                return [
                  (_ctx.ok)
                    ? (_openBlock(), _createBlock(\\"div\\", { key: 0 }, [
                        (_openBlock(true), _createBlock(_Fragment, null, _renderList(list, (i) => {
                          return (_openBlock(), _createBlock(\\"span\\"))
                        }), 256 /* UNKEYED_FRAGMENT */))
                      ]))
                    : _createCommentVNode(\\"v-if\\", true)
                ]
              }
            }),
            bar: _withCtx(({ ok }, _push, _parent, _scopeId) => {
              if (_push) {
                if (ok) {
                  _push(\`<div\${_scopeId}><!--[-->\`)
                  _ssrRenderList(_ctx.list, (i) => {
                    _push(\`<span\${_scopeId}></span>\`)
                  })
                  _push(\`<!--]--></div>\`)
                } else {
                  _push(\`<!---->\`)
                }
              } else {
                return [
                  ok
                    ? (_openBlock(), _createBlock(\\"div\\", { key: 0 }, [
                        (_openBlock(true), _createBlock(_Fragment, null, _renderList(_ctx.list, (i) => {
                          return (_openBlock(), _createBlock(\\"span\\"))
                        }), 256 /* UNKEYED_FRAGMENT */))
                      ]))
                    : _createCommentVNode(\\"v-if\\", true)
                ]
              }
            }),
            _: 1
          }, _parent))
        }"
      `)
    })

    test('built-in fallthroughs', () => {
      expect(compile(`<transition><div/></transition>`).code)
        .toMatchInlineSnapshot(`
        "
        return function ssrRender(_ctx, _push, _parent) {
          _push(\`<div></div>\`)
        }"
      `)

      expect(compile(`<transition-group><div/></transition-group>`).code)
        .toMatchInlineSnapshot(`
        "
        return function ssrRender(_ctx, _push, _parent) {
          _push(\`<!--[--><div></div><!--]-->\`)
        }"
      `)

      expect(compile(`<keep-alive><foo/></keep-alive>`).code)
        .toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent } = require(\\"vue\\")
        const { ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent) {
          const _component_foo = _resolveComponent(\\"foo\\")

          _push(_ssrRenderComponent(_component_foo, null, null, _parent))
        }"
      `)
    })
  })
})
