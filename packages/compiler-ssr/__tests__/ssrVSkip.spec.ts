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
    expect(compile(`<div v-skip="foo">{{hello}}</div>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<!--[-->\${_ssrInterpolate(_ctx.hello)}<!--]-->\`)
          } else {
            _push(\`<div\${
              _ssrRenderAttrs(_attrs)
            }>\${
              _ssrInterpolate(_ctx.hello)
            }</div>\`)
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
    expect(compile(`<Comp v-skip="ok">{{foo}}</Comp>`).code)
      .toMatchInlineSnapshot(`
        "const { withCtx: _withCtx, resolveComponent: _resolveComponent, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode } = require("vue")
        const { ssrRenderComponent: _ssrRenderComponent, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          const _component_Comp = _resolveComponent("Comp")

          if (_ctx.ok) {
            _push(\`<!--[-->\${_ssrInterpolate(_ctx.foo)}<!--]-->\`)
          } else {
            _push(_ssrRenderComponent(_component_Comp, _attrs, {
              default: _withCtx((_, _push, _parent, _scopeId) => {
                if (_push) {
                  _push(\`\${_ssrInterpolate(_ctx.foo)}\`)
                } else {
                  return [
                    _createTextVNode(_toDisplayString(_ctx.foo), 1 /* TEXT */)
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
          <template #default>{{default}}</template>
          <template #foo>{{foo}}</template>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.ok) {
          _push(\`<!--[-->\${_ssrInterpolate(_ctx.default)}<!--]-->\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, _attrs, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`\${_ssrInterpolate(_ctx.default)}\`)
              } else {
                return [
                  _createTextVNode(_toDisplayString(_ctx.default), 1 /* TEXT */)
                ]
              }
            }),
            foo: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`\${_ssrInterpolate(_ctx.foo)}\`)
              } else {
                return [
                  _createTextVNode(_toDisplayString(_ctx.foo), 1 /* TEXT */)
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
          <template #foo>{{foo}}</template>
          <div/>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, createVNode: _createVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.ok) {
          _push(\`<!--[--><span></span><div></div><!--]-->\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, _attrs, {
            foo: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`\${_ssrInterpolate(_ctx.foo)}\`)
              } else {
                return [
                  _createTextVNode(_toDisplayString(_ctx.foo), 1 /* TEXT */)
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
          <template v-if="yes" #default>{{default}}</template>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, createSlots: _createSlots, resolveComponent: _resolveComponent, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, _attrs, _createSlots({ _: 2 /* DYNAMIC */ }, [
          (_ctx.yes)
            ? {
                name: "default",
                fn: _withCtx((_, _push, _parent, _scopeId) => {
                  if (_push) {
                    _push(\`\${_ssrInterpolate(_ctx.default)}\`)
                  } else {
                    return [
                      _createTextVNode(_toDisplayString(_ctx.default), 1 /* TEXT */)
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

  test('on component with implicit default slot + v-if', () => {
    expect(
      compile(
        `<Comp v-skip="ok">
          <span v-if="yes">{{default}}</span>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, toDisplayString: _toDisplayString, openBlock: _openBlock, createBlock: _createBlock, createCommentVNode: _createCommentVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        if (_ctx.ok) {
          _push(\`<!--[-->\`)
          if (_ctx.yes) {
            _push(\`<span>\${_ssrInterpolate(_ctx.default)}</span>\`)
          } else {
            _push(\`<!---->\`)
          }
          _push(\`<!--]-->\`)
        } else {
          _push(_ssrRenderComponent(_component_Comp, _attrs, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                if (_ctx.yes) {
                  _push(\`<span\${
                    _scopeId
                  }>\${
                    _ssrInterpolate(_ctx.default)
                  }</span>\`)
                } else {
                  _push(\`<!---->\`)
                }
              } else {
                return [
                  (_ctx.yes)
                    ? (_openBlock(), _createBlock("span", { key: 0 }, _toDisplayString(_ctx.default), 1 /* TEXT */))
                    : _createCommentVNode("v-if", true)
                ]
              }
            }),
            _: 1 /* STABLE */
          }, _parent))
        }
      }"
    `)
  })

  test('on component with dynamic slot', () => {
    expect(
      compile(
        `<Comp v-skip="ok">
          <template #[foo]>{{foo}}</template>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, _attrs, {
          [_ctx.foo]: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`\${_ssrInterpolate(_ctx.foo)}\`)
            } else {
              return [
                _createTextVNode(_toDisplayString(_ctx.foo), 1 /* TEXT */)
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
          <template #[foo]>{{foo}}</template>
          <template #default>{{default}}</template>
        </Comp>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveComponent: _resolveComponent, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode } = require("vue")
      const { ssrRenderComponent: _ssrRenderComponent, ssrRenderSkipComponent: _ssrRenderSkipComponent, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Comp = _resolveComponent("Comp")

        _push(_ssrRenderSkipComponent(_push, _ctx.ok, _component_Comp, _attrs, {
          [_ctx.foo]: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`\${_ssrInterpolate(_ctx.foo)}\`)
            } else {
              return [
                _createTextVNode(_toDisplayString(_ctx.foo), 1 /* TEXT */)
              ]
            }
          }),
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`\${_ssrInterpolate(_ctx.default)}\`)
            } else {
              return [
                _createTextVNode(_toDisplayString(_ctx.default), 1 /* TEXT */)
              ]
            }
          }),
          _: 2 /* DYNAMIC */
        }, _parent))
      }"
    `)
  })

  test('on dynamic component with default slot', () => {
    expect(
      compile(`<component :is="Comp" v-skip="ok">{{foo}}</component>`).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveDynamicComponent: _resolveDynamicComponent, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, createVNode: _createVNode } = require("vue")
      const { ssrRenderVNode: _ssrRenderVNode, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.ok) {
          _push(\`<!--[-->\${_ssrInterpolate(_ctx.foo)}<!--]-->\`)
        } else {
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent(_ctx.Comp), _attrs, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`\${_ssrInterpolate(_ctx.foo)}\`)
              } else {
                return [
                  _createTextVNode(_toDisplayString(_ctx.foo), 1 /* TEXT */)
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
          <template #[foo]>{{foo}}</template>
        </component>
      `).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx, resolveDynamicComponent: _resolveDynamicComponent, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, createVNode: _createVNode } = require("vue")
      const { ssrRenderVNode: _ssrRenderVNode, ssrRenderSkipVNode: _ssrRenderSkipVNode, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _ssrRenderSkipVNode(_ctx.ok, _push, _createVNode(_resolveDynamicComponent(_ctx.Comp), _attrs, {
          [_ctx.foo]: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`\${_ssrInterpolate(_ctx.foo)}\`)
            } else {
              return [
                _createTextVNode(_toDisplayString(_ctx.foo), 1 /* TEXT */)
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
      compile(`
        <teleport to="target" v-skip="ok">
          <div>{{foo}}</div>
        </teleport>`).code,
    ).toMatchInlineSnapshot(`
      "const { withCtx: _withCtx } = require("vue")
      const { ssrInterpolate: _ssrInterpolate, ssrRenderTeleport: _ssrRenderTeleport } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.ok) {
          _push(\`<div>\${_ssrInterpolate(_ctx.foo)}</div>\`)
        } else {
          _ssrRenderTeleport(_push, (_push) => {
            _push(\`<div>\${_ssrInterpolate(_ctx.foo)}</div>\`)
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
