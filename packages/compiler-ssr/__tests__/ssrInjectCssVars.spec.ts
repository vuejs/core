import { compile } from '../src'

describe('ssr: inject <style vars>', () => {
  test('basic', () => {
    expect(
      compile(`<div/>`, {
        ssrCssVars: `{ color }`
      }).code
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require(\\"vue\\")
      const { ssrResolveCssVars: _ssrResolveCssVars, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _cssVars = ssrResolveCssVars({ color: _ctx.color })
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
      "const { ssrResolveCssVars: _ssrResolveCssVars, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _cssVars = ssrResolveCssVars({ color: _ctx.color })
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
      const { ssrResolveCssVars: _ssrResolveCssVars, ssrRenderAttrs: _ssrRenderAttrs, ssrRenderComponent: _ssrRenderComponent } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_foo = _resolveComponent(\\"foo\\")

        const _cssVars = ssrResolveCssVars({ color: _ctx.color })
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
      const { ssrResolveCssVars: _ssrResolveCssVars, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _cssVars = ssrResolveCssVars({ color: _ctx.color })
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

  test('w/ scopeId', () => {
    expect(
      compile(`<div/>`, {
        ssrCssVars: `{ color }`,
        scopeId: 'data-v-foo'
      }).code
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require(\\"vue\\")
      const { ssrResolveCssVars: _ssrResolveCssVars, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _cssVars = ssrResolveCssVars({ color: _ctx.color }, \\"data-v-foo\\")
        _push(\`<div\${_ssrRenderAttrs(_mergeProps(_attrs, _cssVars))} data-v-foo></div>\`)
      }"
    `)
  })
})
