import { compile } from '../src'
import { SSR_RENDER_SLOT_INNER, ssrHelpers } from '../src/runtimeHelpers'

describe('ssr: <slot>', () => {
  test('basic', () => {
    expect(compile(`<slot/>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent)
      }"
    `)
  })

  test('with name', () => {
    expect(compile(`<slot name="foo" />`).code).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent)
      }"
    `)
  })

  test('with dynamic name', () => {
    expect(compile(`<slot :name="bar.baz" />`).code).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderSlot(_ctx.$slots, _ctx.bar.baz, {}, null, _push, _parent)
      }"
    `)
  })

  test('with props', () => {
    expect(compile(`<slot name="foo" :p="1" bar="2" />`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderSlot: _ssrRenderSlot } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _ssrRenderSlot(_ctx.$slots, "foo", {
            p: 1,
            bar: "2"
          }, null, _push, _parent)
        }"
      `)
  })

  test('with fallback', () => {
    expect(compile(`<slot>some {{ fallback }} content</slot>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderSlot: _ssrRenderSlot, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _ssrRenderSlot(_ctx.$slots, "default", {}, () => {
            _push(\`some \${_ssrInterpolate(_ctx.fallback)} content\`)
          }, _push, _parent)
        }"
      `)
  })

  test('with scopeId', async () => {
    expect(
      compile(`<slot/>`, {
        scopeId: 'hello',
      }).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, "hello-s")
      }"
    `)
  })

  test('with scopeId + slotted:false', async () => {
    expect(
      compile(`<slot/>`, {
        scopeId: 'hello',
        slotted: false,
      }).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent)
      }"
    `)
  })

  test('with forwarded scopeId', async () => {
    expect(
      compile(`<Comp><slot/></Comp>`, {
        scopeId: 'hello',
      }).code,
    ).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx, renderSlot: _renderSlot } = require("vue")
      const { ssrRenderSlot: _ssrRenderSlot, ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderComponent(_component_Comp, _attrs, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, "hello-s" + _scopeId)
            } else {
              return [
                _renderSlot(_ctx.$slots, "default")
              ]
            }
          }),
          _: 3 /* FORWARDED */
        }, _parent))
      }"
    `)
  })

  test('inside transition', () => {
    const { code } = compile(`<transition><slot/></transition>`)
    expect(code).toMatch(ssrHelpers[SSR_RENDER_SLOT_INNER])
    expect(code).toMatchInlineSnapshot(`
      "const { ssrRenderSlotInner: _ssrRenderSlotInner } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderSlotInner(_ctx.$slots, "default", {}, null, _push, _parent, null, true)
      }"
    `)
  })

  test('inside transition-group', () => {
    const { code } = compile(
      `<TransitionGroup tag="div"><slot/></TransitionGroup>`,
    )
    expect(code).toMatch(ssrHelpers[SSR_RENDER_SLOT_INNER])
    expect(code).toMatchInlineSnapshot(`
      "const { ssrRenderSlotInner: _ssrRenderSlotInner, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}>\`)
        _ssrRenderSlotInner(_ctx.$slots, "default", {}, null, _push, _parent, null, true)
        _push(\`</div>\`)
      }"
    `)
  })

  test('with v-if inside transition', () => {
    const { code } = compile(`<transition><slot v-if="true"/></transition>`)
    expect(code).toMatch(ssrHelpers[SSR_RENDER_SLOT_INNER])
    expect(code).toMatchInlineSnapshot(`
      "const { ssrRenderSlotInner: _ssrRenderSlotInner } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (true) {
          _ssrRenderSlotInner(_ctx.$slots, "default", {}, null, _push, _parent, null, true)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })
})
