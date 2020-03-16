import { compile } from '../src'

const scopeId = 'data-v-xxxxxxx'

describe('ssr: scopeId', () => {
  test('basic', () => {
    expect(
      compile(`<div><span>hello</span></div>`, {
        scopeId
      }).code
    ).toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div data-v-xxxxxxx><span data-v-xxxxxxx>hello</span></div>\`)
      }"
    `)
  })

  test('inside slots (only text)', () => {
    // should have no branching inside slot
    expect(
      compile(`<foo>foo</foo>`, {
        scopeId
      }).code
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
          _: 1
        }, _parent))
      }"
    `)
  })

  test('inside slots (with elements)', () => {
    expect(
      compile(`<foo><span>hello</span></foo>`, {
        scopeId
      }).code
    ).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx, createVNode: _createVNode } = require(\\"vue\\")
      const { ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        const _component_foo = _resolveComponent(\\"foo\\")

        _push(_ssrRenderComponent(_component_foo, null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<span data-v-xxxxxxx\${_scopeId}>hello</span>\`)
            } else {
              return [
                _createVNode(\\"span\\", null, \\"hello\\")
              ]
            }
          }),
          _: 1
        }, _parent))
      }"
    `)
  })

  test('nested slots', () => {
    expect(
      compile(`<foo><span>hello</span><bar><span/></bar></foo>`, {
        scopeId
      }).code
    ).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx, createVNode: _createVNode } = require(\\"vue\\")
      const { ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        const _component_foo = _resolveComponent(\\"foo\\")
        const _component_bar = _resolveComponent(\\"bar\\")

        _push(_ssrRenderComponent(_component_foo, null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<span data-v-xxxxxxx\${_scopeId}>hello</span>\`)
              _push(_ssrRenderComponent(_component_bar, null, {
                default: _withCtx((_, _push, _parent, _scopeId) => {
                  if (_push) {
                    _push(\`<span data-v-xxxxxxx\${_scopeId}></span>\`)
                  } else {
                    return [
                      _createVNode(\\"span\\")
                    ]
                  }
                }),
                _: 1
              }, _parent))
            } else {
              return [
                _createVNode(\\"span\\", null, \\"hello\\"),
                _createVNode(_component_bar, null, {
                  default: _withCtx(() => [
                    _createVNode(\\"span\\")
                  ]),
                  _: 1
                })
              ]
            }
          }),
          _: 1
        }, _parent))
      }"
    `)
  })
})
