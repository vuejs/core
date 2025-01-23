import { compile } from '@vue/compiler-ssr'

describe('ssr: v-skip', () => {
  test('basic', () => {
    expect(compile(`<div v-skip="foo"/>`).code).toMatchInlineSnapshot(`
      "const { createCommentVNode: _createCommentVNode } = require("vue")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _createCommentVNode("v-skip", true)
        } else {
          _push(\`<div></div>\`)
        }
      }"
    `)
  })

  test('with text children', () => {
    expect(compile(`<div v-skip="foo">hello</div>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<!--[-->hello<!--]-->\`)
        } else {
          _push(\`<div>hello</div>\`)
        }
      }"
    `)
  })

  test('with element children', () => {
    expect(compile(`<div v-skip="foo"><span/></div>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<span></span>\`)
        } else {
          _push(\`<div><span></span></div>\`)
        }
      }"
    `)
  })

  test('with component children', () => {
    expect(compile(`<div v-skip="foo"><MyComponent/></div>`).code)
      .toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent } = require("vue")
        const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          const _component_MyComponent = _resolveComponent("MyComponent")

          if (_ctx.foo) {
            _push(_ssrRenderComponent(_component_MyComponent, null, null, _parent))
          } else {
            _push(\`<div>\`)
            _push(_ssrRenderComponent(_component_MyComponent, null, null, _parent))
            _push(\`</div>\`)
          }
        }"
      `)
  })

  test('with multiple children', () => {
    expect(compile(`<div v-skip="foo"><span/><span/></div>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<!--[--><span></span><span></span><!--]-->\`)
        } else {
          _push(\`<div><span></span><span></span></div>\`)
        }
      }"
    `)
  })

  test('nested v-skip', () => {
    expect(compile(`<div v-skip="foo"><div v-skip="bar"/></div>`).code)
      .toMatchInlineSnapshot(`
      "const { createCommentVNode: _createCommentVNode } = require("vue")

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
          _push(\`<div>\`)
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

  test.todo('with key', () => {
    expect(compile(`<div v-skip="ok" key="foo"/>`).code).toMatchInlineSnapshot(`
      "const { createCommentVNode: _createCommentVNode } = require("vue")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.ok) {
          _createCommentVNode("v-skip", true)
        } else {
          _push(\`<div></div>\`)
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
      "const { withCtx: _withCtx, createCommentVNode: _createCommentVNode, resolveComponent: _resolveComponent } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.foo) {
          _createCommentVNode("v-skip", true)
        } else {
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        }
      }"
    `)
  })

  test('on component with default slot', () => {
    expect(compile(`<Comp v-skip="ok">foo</Comp>`).code).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.ok) {
          _push(\`<!--[-->foo<!--]-->\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`foo\`)
              }
            }),
            _: 1 /* STABLE */
          }, _parent))
        }
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
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.ok) {
          _push(\`<!--[-->default<!--]-->\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`default\`)
              }
            }),
            foo: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`foo\`)
              }
            }),
            _: 1 /* STABLE */
          }, _parent))
        }
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
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.ok) {
          _push(\`<!--[--><span></span><div></div><!--]-->\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, null, {
            foo: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`foo\`)
              }
            }),
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<span\${
                  _scopeId
                }></span><div\${
                  _scopeId
                }></div>\`)
              }
            }),
            _: 1 /* STABLE */
          }, _parent))
        }
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
      "const { withCtx: _withCtx, resolveDynamicComponent: _resolveDynamicComponent, createVNode: _createVNode } = require("vue")
      const { ssrRenderSlot: _ssrRenderSlot, ssrRenderVNode: _ssrRenderVNode } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.ok) {
          _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId)
        } else {
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent(_ctx.Comp), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId)
              }
            }),
            _: 3 /* FORWARDED */
          }), _parent)
        }
      }"
    `)
  })
})
