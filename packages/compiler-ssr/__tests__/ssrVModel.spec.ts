import { compile } from '../src'

function compileWithWrapper(src: string) {
  return compile(`<div>${src}</div>`)
}

describe('ssr: v-model', () => {
  test('<input> (text types)', () => {
    expect(compileWithWrapper(`<input v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input\${
          _ssrRenderAttr(\\"value\\", _ctx.bar)
        }></div>\`)
      }"
    `)

    expect(compileWithWrapper(`<input type="email" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input type=\\"email\\"\${
          _ssrRenderAttr(\\"value\\", _ctx.bar)
        }></div>\`)
      }"
    `)
  })

  test('<input type="radio">', () => {
    expect(
      compileWithWrapper(`<input type="radio" value="foo" v-model="bar">`).code
    ).toMatchInlineSnapshot(`
      "const { ssrLooseEqual: _ssrLooseEqual, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input type=\\"radio\\" value=\\"foo\\"\${
          (_ssrLooseEqual(_ctx.bar, \\"foo\\")) ? \\" checked\\" : \\"\\"
        }></div>\`)
      }"
    `)
  })

  test('<input type="checkbox"', () => {
    expect(compileWithWrapper(`<input type="checkbox" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrLooseContain: _ssrLooseContain, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input type=\\"checkbox\\"\${
          ((Array.isArray(_ctx.bar))
            ? _ssrLooseContain(_ctx.bar, null)
            : _ctx.bar) ? \\" checked\\" : \\"\\"
        }></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(`<input type="checkbox" value="foo" v-model="bar">`)
        .code
    ).toMatchInlineSnapshot(`
      "const { ssrLooseContain: _ssrLooseContain, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input type=\\"checkbox\\" value=\\"foo\\"\${
          ((Array.isArray(_ctx.bar))
            ? _ssrLooseContain(_ctx.bar, \\"foo\\")
            : _ctx.bar) ? \\" checked\\" : \\"\\"
        }></div>\`)
      }"
    `)
  })

  test('<textarea>', () => {
    expect(compileWithWrapper(`<textarea v-model="foo">bar</textarea>`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><textarea>\${
          _ssrInterpolate(_ctx.foo)
        }</textarea></div>\`)
      }"
    `)
  })

  test('<input :type="x">', () => {
    expect(compileWithWrapper(`<input :type="x" v-model="foo">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderDynamicModel: _ssrRenderDynamicModel, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input\${
          _ssrRenderAttr(\\"type\\", _ctx.x)
        }\${
          _ssrRenderDynamicModel(_ctx.x, _ctx.foo, null)
        }></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(`<input :type="x" v-model="foo" value="bar">`).code
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderDynamicModel: _ssrRenderDynamicModel, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input\${
          _ssrRenderAttr(\\"type\\", _ctx.x)
        }\${
          _ssrRenderDynamicModel(_ctx.x, _ctx.foo, \\"bar\\")
        } value=\\"bar\\"></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(`<input :type="x" v-model="foo" :value="bar">`).code
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderDynamicModel: _ssrRenderDynamicModel, ssrRenderAttrs: _ssrRenderAttrs } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input\${
          _ssrRenderAttr(\\"type\\", _ctx.x)
        }\${
          _ssrRenderDynamicModel(_ctx.x, _ctx.foo, _ctx.bar)
        }\${
          _ssrRenderAttr(\\"value\\", _ctx.bar)
        }></div>\`)
      }"
    `)
  })

  test('<input v-bind="obj">', () => {
    expect(compileWithWrapper(`<input v-bind="obj" v-model="foo">`).code)
      .toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require(\\"vue\\")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrGetDynamicModelProps: _ssrGetDynamicModelProps } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        let _temp0

        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input\${
          _ssrRenderAttrs((_temp0 = _ctx.obj, _mergeProps(_temp0, _ssrGetDynamicModelProps(_temp0, _ctx.foo))))
        }></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(`<input id="x" v-bind="obj" v-model="foo" class="y">`)
        .code
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require(\\"vue\\")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrGetDynamicModelProps: _ssrGetDynamicModelProps } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        let _temp0

        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input\${
          _ssrRenderAttrs((_temp0 = _mergeProps({ id: \\"x\\" }, _ctx.obj, { class: \\"y\\" }), _mergeProps(_temp0, _ssrGetDynamicModelProps(_temp0, _ctx.foo))))
        }></div>\`)
      }"
    `)
  })
})
