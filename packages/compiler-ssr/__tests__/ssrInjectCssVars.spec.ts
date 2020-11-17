import { compile } from '../src'

describe('ssr: inject <style vars>', () => {
  test('basic', () => {
    expect(
      compile(`<div/>`, {
        ssrCssVars: `{ color }`
      }).code
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require(\\"vue\\")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _cssVars = { style: { color: _ctx.color }}
        _push(\`<div\${_ssrRenderAttrs(_mergeProps(_attrs, _cssVars))}></div>\`)
      }"
    `)
  })

  test('fragment', () => {
    expect(
      compile(`<div/><div/>`, {
        ssrCssVars: `{ color }`
      }).code
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _cssVars = { style: { color: _ctx.color }}
        _push(\`<!--[--><div\${
          _ssrRenderAttrs(_cssVars)
        }></div><div\${
          _ssrRenderAttrs(_cssVars)
        }></div><!--]-->\`)
      }"
    `)
  })

  test('passing on to components', () => {
    expect(
      compile(`<div/><foo/>`, {
        ssrCssVars: `{ color }`
      }).code
    ).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent } = require(\\"vue\\")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_foo = _resolveComponent(\\"foo\\")

        const _cssVars = { style: { color: _ctx.color }}
        _push(\`<!--[--><div\${_ssrRenderAttrs(_cssVars)}></div>\`)
        _push(_ssrRenderComponent(_component_foo, _cssVars, null, _parent))
        _push(\`<!--]-->\`)
      }"
    `)
  })

  test('v-if branches', () => {
    expect(
      compile(`<div v-if="ok"/><template v-else><div/><div/></template>`, {
        ssrCssVars: `{ color }`
      }).code
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require(\\"vue\\")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _cssVars = { style: { color: _ctx.color }}
        if (_ctx.ok) {
          _push(\`<div\${_ssrRenderAttrs(_mergeProps(_attrs, _cssVars))}></div>\`)
        } else {
          _push(\`<!--[--><div\${
            _ssrRenderAttrs(_cssVars)
          }></div><div\${
            _ssrRenderAttrs(_cssVars)
          }></div><!--]-->\`)
        }
      }"
    `)
  })

  test('w/ suspense', () => {
    expect(
      compile(
        `<Suspense>
          <div>ok</div>
          <template #fallback>
            <div>fallback</div>
          </template>
        </Suspense>`,
        {
          ssrCssVars: `{ color }`
        }
      ).code
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx } = require(\\"vue\\")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderSuspense: _ssrRenderSuspense } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _cssVars = { style: { color: _ctx.color }}
        _ssrRenderSuspense(_push, {
          fallback: () => {
            _push(\`<div\${_ssrRenderAttrs(_cssVars)}>fallback</div>\`)
          },
          default: () => {
            _push(\`<div\${_ssrRenderAttrs(_cssVars)}>ok</div>\`)
          },
          _: 1
        })
      }"
    `)
  })
})
