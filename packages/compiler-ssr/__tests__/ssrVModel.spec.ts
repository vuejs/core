import { compile } from '../src'

describe('ssr: v-model', () => {
  test('<input> (text types)', () => {
    expect(compile(`<input v-model="bar">`).code).toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input\${_ssrRenderAttr(\\"value\\", _ctx.bar)}>\`)
      }"
    `)

    expect(compile(`<input type="email" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input type=\\"email\\"\${_ssrRenderAttr(\\"value\\", _ctx.bar)}>\`)
      }"
    `)
  })

  test('<input type="radio">', () => {
    expect(compile(`<input type="radio" value="foo" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrLooseEqual: _ssrLooseEqual } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input type=\\"radio\\" value=\\"foo\\"\${(_ssrLooseEqual(_ctx.bar, \\"foo\\")) ? \\" checked\\" : \\"\\"}>\`)
      }"
    `)
  })

  test('<input type="checkbox"', () => {
    expect(compile(`<input type="checkbox" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrLooseContain: _ssrLooseContain } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input type=\\"checkbox\\"\${((Array.isArray(_ctx.bar))
          ? _ssrLooseContain(_ctx.bar, null)
          : _ctx.bar) ? \\" checked\\" : \\"\\"}>\`)
      }"
    `)

    expect(compile(`<input type="checkbox" value="foo" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrLooseContain: _ssrLooseContain } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input type=\\"checkbox\\" value=\\"foo\\"\${((Array.isArray(_ctx.bar))
          ? _ssrLooseContain(_ctx.bar, \\"foo\\")
          : _ctx.bar) ? \\" checked\\" : \\"\\"}>\`)
      }"
    `)
  })

  test('<textarea>', () => {
    expect(compile(`<textarea v-model="foo">bar</textarea>`).code)
      .toMatchInlineSnapshot(`
      "const { ssrInterpolate: _ssrInterpolate } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<textarea>\${_ssrInterpolate(_ctx.foo)}</textarea>\`)
      }"
    `)
  })

  test('<input :type="x">', () => {
    expect(compile(`<input :type="x" v-model="foo">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderDynamicModel: _ssrRenderDynamicModel } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input\${
          _ssrRenderAttr(\\"type\\", _ctx.x)
        }\${
          _ssrRenderDynamicModel(_ctx.x, _ctx.foo, null)
        }>\`)
      }"
    `)

    expect(compile(`<input :type="x" v-model="foo" value="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderDynamicModel: _ssrRenderDynamicModel } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input\${
          _ssrRenderAttr(\\"type\\", _ctx.x)
        }\${
          _ssrRenderDynamicModel(_ctx.x, _ctx.foo, \\"bar\\")
        } value=\\"bar\\">\`)
      }"
    `)

    expect(compile(`<input :type="x" v-model="foo" :value="bar">`).code)
      .toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderDynamicModel: _ssrRenderDynamicModel } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<input\${
          _ssrRenderAttr(\\"type\\", _ctx.x)
        }\${
          _ssrRenderDynamicModel(_ctx.x, _ctx.foo, _ctx.bar)
        }\${
          _ssrRenderAttr(\\"value\\", _ctx.bar)
        }>\`)
      }"
    `)
  })

  test('<input v-bind="obj">', () => {
    expect(compile(`<input v-bind="obj" v-model="foo">`).code)
      .toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require(\\"vue\\")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrGetDynamicModelProps: _ssrGetDynamicModelProps } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        let _temp0

        _push(\`<input\${_ssrRenderAttrs((_temp0 = _ctx.obj, _mergeProps(_temp0, _ssrGetDynamicModelProps(_temp0, _ctx.foo))))}>\`)
      }"
    `)

    expect(compile(`<input id="x" v-bind="obj" v-model="foo" class="y">`).code)
      .toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require(\\"vue\\")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrGetDynamicModelProps: _ssrGetDynamicModelProps } = require(\\"@vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent) {
        let _temp0

        _push(\`<input\${_ssrRenderAttrs((_temp0 = _mergeProps({ id: \\"x\\" }, _ctx.obj, { class: \\"y\\" }), _mergeProps(_temp0, _ssrGetDynamicModelProps(_temp0, _ctx.foo))))}>\`)
      }"
    `)
  })
})
