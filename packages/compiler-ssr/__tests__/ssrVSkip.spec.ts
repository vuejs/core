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

  test('on component without slot', () => {
    // equivalent to <Comp v-if="ok"/>
    expect(compile(`<Comp v-skip="foo"/>`).code).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, createCommentVNode: _createCommentVNode, resolveComponent: _resolveComponent } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.foo) {
          _createCommentVNode("v-skip", true)
        } else {
          _push(_ssrRenderComponent(_component_Comp, _attrs, null, _parent))
        }
      }"
    `)
  })

  test('on component with default slot', () => {
    expect(compile(`<Comp v-skip="ok">foo</Comp>`).code).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.ok) {
          _push(\`<!--[-->foo<!--]-->\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, _attrs, {
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
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.ok) {
          _push(\`<!--[-->default<!--]-->\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, _attrs, {
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
        }
      }"
    `)
  })

  test('on component with multiple implicit default slot', () => {
    expect(
      compile(
        `<Comp v-skip="ok">
          <span/>
          <template #foo>foo</template>
          <div/>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, createTextVNode: _createTextVNode, createVNode: _createVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.ok) {
          _push(\`<!--[--><span></span><div></div><!--]-->\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, _attrs, {
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
        }
      }"
    `)
  })

  test('on component with name default slot + v-if', () => {
    expect(
      compile(
        `<Comp v-skip="ok">
          <template v-if="yes" #default>default</template>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, createSlots: _createSlots, resolveComponent: _resolveComponent, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, _attrs, _createSlots({ _: 2 /* DYNAMIC */ }, [
          (_ctx.yes)
            ? {
                name: "default",
                fn: _withCtx((_, _push, _parent, _scopeId) => {
                  if (_push) {
                    _push(\`default\`)
                  } else {
                    return [
                      _createTextVNode("default")
                    ]
                  }
                }),
                key: "0"
              }
            : undefined
        ]), _parent))
      }"
    `)
  })

  test.todo('on component with implicit default slot + v-if', () => {
    expect(
      compile(
        `<Comp v-skip="ok">
          <span v-if="yes">default</span>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
    `)
  })

  test('on component with dynamic slot', () => {
    expect(
      compile(
        `<Comp v-skip="ok">
          <template #[foo]>foo</template>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, _attrs, {
          [_ctx.foo]: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`foo\`)
            } else {
              return [
                _createTextVNode("foo")
              ]
            }
          }),
          _: 2 /* DYNAMIC */
        }, _parent))
      }"
    `)
  })

  test('on component with dynamic slot + default slot', () => {
    expect(
      compile(
        `<Comp v-skip="ok">
          <template #[foo]>foo</template>
          <template #default>default</template>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, _attrs, {
          [_ctx.foo]: _withCtx((_, _push, _parent, _scopeId) => {
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
              _push(\`default\`)
            } else {
              return [
                _createTextVNode("default")
              ]
            }
          }),
          _: 2 /* DYNAMIC */
        }, _parent))
      }"
    `)
  })

  test('on dynamic component with default slot', () => {
    expect(compile(`<component :is="Comp" v-skip="ok">foo</component>`).code)
      .toMatchInlineSnapshot(`
        "const { withCtx: _withCtx, resolveDynamicComponent: _resolveDynamicComponent, createTextVNode: _createTextVNode, createVNode: _createVNode } = require("vue")
        const { ssrRenderVNode: _ssrRenderVNode } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.ok) {
            _push(\`<!--[-->foo<!--]-->\`)
          } else {
            _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent(_ctx.Comp), _attrs, {
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
            }), _parent)
          }
        }"
      `)
  })

  test('on dynamic component with dynamic slot', () => {
    expect(
      compile(`
      <component :is="Comp" v-skip="ok">
          <template #[foo]>foo</template>
        </component>
      `).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveDynamicComponent: _resolveDynamicComponent, createTextVNode: _createTextVNode, createVNode: _createVNode } = require("vue")
      const { ssrRenderVNode: _ssrRenderVNode, ssrRenderSkipVNode: _ssrRenderSkipVNode } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderSkipVNode(_ctx.ok, _push, _createVNode(_resolveDynamicComponent(_ctx.Comp), _attrs, {
          [_ctx.foo]: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`foo\`)
            } else {
              return [
                _createTextVNode("foo")
              ]
            }
          }),
          _: 2 /* DYNAMIC */
        }), _parent)
      }"
    `)
  })

  test('on Teleport', () => {
    expect(
      compile(`<teleport to="target" v-skip="ok">
          <div>foo</div>
        </teleport>`).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx } = require("vue")
      const { ssrRenderTeleport: _ssrRenderTeleport } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.ok) {
          _push(\`<div>foo</div>\`)
        } else {
          _ssrRenderTeleport(_push, (_push) => {
            _push(\`<div>foo</div>\`)
          }, "target", false, _parent)
        }
      }"
    `)
  })

  test('fragment with component v-skip', () => {
    // here is verified that when root is a fragment, `_attrs` won't be injected
    // into skip node's alternate branch
    expect(
      compile(`
      <div></div>
      <Comp v-skip="ok"><span/></Comp>
    `).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, createVNode: _createVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(\`<!--[--><div></div>\`)
        if (_ctx.ok) {
          _push(\`<span></span>\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, null, {
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
        }
        _push(\`<!--]-->\`)
      }"
    `)
  })
})
