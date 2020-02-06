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
      "const { resolveComponent } = require(\\"vue\\")
      const { _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        const _component_foo = resolveComponent(\\"foo\\")

        _push(_ssrRenderComponent(_component_foo, null, {
          default: (_, _push, _parent, _scopeId) => {
            _push(\`foo\`)
          },
          _compiled: true
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
      "const { resolveComponent } = require(\\"vue\\")
      const { _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        const _component_foo = resolveComponent(\\"foo\\")

        _push(_ssrRenderComponent(_component_foo, null, {
          default: (_, _push, _parent, _scopeId) => {
            if (_scopeId) {
              _push(\`<span data-v-xxxxxxx \${_scopeId}>hello</span>\`)
            } else {
              _push(\`<span data-v-xxxxxxx>hello</span>\`)
            }
          },
          _compiled: true
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
      "const { resolveComponent } = require(\\"vue\\")
      const { _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        const _component_bar = resolveComponent(\\"bar\\")
        const _component_foo = resolveComponent(\\"foo\\")

        _push(_ssrRenderComponent(_component_foo, null, {
          default: (_, _push, _parent, _scopeId) => {
            if (_scopeId) {
              _push(\`<span data-v-xxxxxxx \${_scopeId}>hello</span>\`)
              _push(_ssrRenderComponent(_component_bar, null, {
                default: (_, _push, _parent, _scopeId) => {
                  if (_scopeId) {
                    _push(\`<span data-v-xxxxxxx \${_scopeId}></span>\`)
                  } else {
                    _push(\`<span data-v-xxxxxxx></span>\`)
                  }
                },
                _compiled: true
              }, _parent))
            } else {
              _push(\`<span data-v-xxxxxxx>hello</span>\`)
              _push(_ssrRenderComponent(_component_bar, null, {
                default: (_, _push, _parent, _scopeId) => {
                  if (_scopeId) {
                    _push(\`<span data-v-xxxxxxx \${_scopeId}></span>\`)
                  } else {
                    _push(\`<span data-v-xxxxxxx></span>\`)
                  }
                },
                _compiled: true
              }, _parent))
            }
          },
          _compiled: true
        }, _parent))
      }"
    `)
  })
})
