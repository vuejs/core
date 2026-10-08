import { compile } from '../src'

describe('ssr compile: suspense', () => {
  test('implicit default', () => {
    expect(compile(`<suspense><foo/></suspense>`).code).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSuspense: _ssrRenderSuspense } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_foo = _resolveComponent("foo")

        _ssrRenderSuspense(_push, {
          default: () => {
            _push(_ssrRenderComponent(_component_foo, null, null, _parent))
          },
          _: 1 /* STABLE */
        })
      }"
    `)
  })

  test('explicit slots', () => {
    expect(
      compile(`<suspense>
      <template #default>
        <foo/>
      </template>
      <template #fallback>
        loading...
      </template>
    </suspense>`).code,
    ).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSuspense: _ssrRenderSuspense } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_foo = _resolveComponent("foo")

        _ssrRenderSuspense(_push, {
          default: () => {
            _push(_ssrRenderComponent(_component_foo, null, null, _parent))
          },
          fallback: () => {
            _push(\` loading... \`)
          },
          _: 1 /* STABLE */
        })
      }"
    `)
  })

  // a vapor component renders the vdom Suspense through the interop, where
  // its slots are vapor slots, hydrating a range of their own
  test('slots keep a range in a vapor component', () => {
    const body = (vapor: boolean) => {
      const { code } = compile(`<suspense><foo/></suspense>`, { vapor })
      return code.slice(code.indexOf('return function'))
    }
    expect(body(false)).not.toContain('<!--[-->')
    expect(body(true)).toContain('<!--[-->')
    expect(body(true)).toContain('<!--]-->')
  })
})
