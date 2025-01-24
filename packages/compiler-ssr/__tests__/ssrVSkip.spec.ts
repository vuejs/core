import { compile } from '@vue/compiler-ssr'

describe('ssr: v-skip', () => {
  test('basic', () => {
    expect(compile(`<div v-skip="foo"/>`).code).toMatchInlineSnapshot(`
      "const { createCommentVNode: _createCommentVNode } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _createCommentVNode("v-skip", true)
        } else {
          _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
        }
      }"
    `)
  })

  test('with text children', () => {
    expect(compile(`<div v-skip="foo">hello</div>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<!--[-->hello<!--]-->\`)
          } else {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}>hello</div>\`)
          }
        }"
      `)
  })

  test('with element children', () => {
    expect(compile(`<div v-skip="foo"><span/></div>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<span></span>\`)
          } else {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}><span></span></div>\`)
          }
        }"
      `)
  })

  test('with component children', () => {
    expect(compile(`<div v-skip="foo"><MyComponent/></div>`).code)
      .toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent } = require("vue")
        const { ssrRenderComponent: _ssrRenderComponent, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          const _component_MyComponent = _resolveComponent("MyComponent")

          if (_ctx.foo) {
            _push(_ssrRenderComponent(_component_MyComponent, null, null, _parent))
          } else {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}>\`)
            _push(_ssrRenderComponent(_component_MyComponent, null, null, _parent))
            _push(\`</div>\`)
          }
        }"
      `)
  })

  test('with multiple children', () => {
    expect(compile(`<div v-skip="foo"><span/><span/></div>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<!--[--><span></span><span></span><!--]-->\`)
          } else {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}><span></span><span></span></div>\`)
          }
        }"
      `)
  })

  test('nested v-skip', () => {
    expect(compile(`<div v-skip="foo"><div v-skip="bar"/></div>`).code)
      .toMatchInlineSnapshot(`
        "const { createCommentVNode: _createCommentVNode } = require("vue")
        const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<!--[-->\`)
            if (_ctx.bar) {
              _createCommentVNode("v-skip", true)
            } else {
              _push(\`<div></div>\`)
            }
            _push(\`<!--]-->\`)
          } else {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}>\`)
            if (_ctx.bar) {
              _createCommentVNode("v-skip", true)
            } else {
              _push(\`<div></div>\`)
            }
            _push(\`</div>\`)
          }
        }"
      `)
  })

  test('v-if + v-skip', () => {
    expect(compile(`<div v-if="ok" v-skip="foo"/>`).code)
      .toMatchInlineSnapshot(`
      "const { createCommentVNode: _createCommentVNode } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.ok) {
          _push(\`<!--[-->\`)
          if (_ctx.foo) {
            _createCommentVNode("v-skip", true)
          } else {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          }
          _push(\`<!--]-->\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('with key', () => {
    expect(compile(`<div v-skip="ok" key="foo"/>`).code).toMatchInlineSnapshot(`
      "const { createCommentVNode: _createCommentVNode, mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.ok) {
          _createCommentVNode("v-skip", true)
        } else {
          _push(\`<div\${_ssrRenderAttrs(_mergeProps({ key: "foo" }, _attrs))}></div>\`)
        }
      }"
    `)
  })

  test('v-else + v-skip', () => {
    expect(compile(`<div v-if="ok"/><div v-else v-skip="nested"/>`).code)
      .toMatchInlineSnapshot(`
        "const { createCommentVNode: _createCommentVNode } = require("vue")
        const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.ok) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          } else {
            _push(\`<!--[-->\`)
            if (_ctx.nested) {
              _createCommentVNode("v-skip", true)
            } else {
              _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
            }
            _push(\`<!--]-->\`)
          }
        }"
      `)
  })

  test('v-else-if + v-skip', () => {
    expect(
      compile(`<div v-if="ok"/><div v-else-if="yes" v-skip="nested"/>`).code,
    ).toMatchInlineSnapshot(`
        "const { createCommentVNode: _createCommentVNode } = require("vue")
        const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.ok) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          } else if (_ctx.yes) {
            _push(\`<!--[-->\`)
            if (_ctx.nested) {
              _createCommentVNode("v-skip", true)
            } else {
              _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
            }
            _push(\`<!--]-->\`)
          } else {
            _push(\`<!---->\`)
          }
        }"
      `)
  })

  test('on component', () => {
    expect(compile(`<Comp v-skip="foo"/>`).code).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.foo, _component_Comp, _attrs, null, _parent))
      }"
    `)
  })

  test('on component with default slot', () => {
    expect(compile(`<Comp v-skip="ok">foo</Comp>`).code).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, _attrs, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`foo\`)
            } else {
              return [
                _createTextVNode("foo")
              ]
            }
          }),
          _: 1 /* STABLE */
        }, _parent))
      }"
    `)
  })

  test('on component with multiple named slot', () => {
    expect(
      compile(
        `<Comp v-skip="ok">
          <template #default>default</template>
          <template #foo>foo</template>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, _attrs, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`default\`)
            } else {
              return [
                _createTextVNode("default")
              ]
            }
          }),
          foo: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`foo\`)
            } else {
              return [
                _createTextVNode("foo")
              ]
            }
          }),
          _: 1 /* STABLE */
        }, _parent))
      }"
    `)
  })

  test('on component with multiple implicit slot', () => {
    expect(
      compile(
        `<Comp v-skip="ok">
          <span/>
          <template #foo>foo</template>
          <div/>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx, createTextVNode: _createTextVNode, createVNode: _createVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, _attrs, {
          foo: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`foo\`)
            } else {
              return [
                _createTextVNode("foo")
              ]
            }
          }),
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<span\${
                _scopeId
              }></span><div\${
                _scopeId
              }></div>\`)
            } else {
              return [
                _createVNode("span"),
                _createVNode("div")
              ]
            }
          }),
          _: 1 /* STABLE */
        }, _parent))
      }"
    `)
  })

  test('on dynamic component', () => {
    expect(
      compile(
        `<component :is="Comp" v-skip="ok">
        <slot/>
      </component>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { resolveDynamicComponent: _resolveDynamicComponent, withCtx: _withCtx, renderSlot: _renderSlot, createVNode: _createVNode } = require("vue")
      const { ssrRenderSlot: _ssrRenderSlot, ssrRenderVNode: _ssrRenderVNode, ssrRenderSkipComponent: _ssrRenderSkipComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderSkipComponent(_push, _ctx.ok, _push, _createVNode(_resolveDynamicComponent(_ctx.Comp), _attrs, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId)
            } else {
              return [
                _renderSlot(_ctx.$slots, "default")
              ]
            }
          }),
          _: 3 /* FORWARDED */
        }), _parent)
      }"
    `)
  })

  test('fragment with component v-skip', () => {
    expect(
      compile(`
      <div></div>
      <Comp v-skip="ok"><span/></Comp>
    `).code,
    ).toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx, createVNode: _createVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(\`<!--[--><div></div>\`)
        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<span\${_scopeId}></span>\`)
            } else {
              return [
                _createVNode("span")
              ]
            }
          }),
          _: 1 /* STABLE */
        }, _parent))
        _push(\`<!--]-->\`)
      }"
    `)
  })
})
