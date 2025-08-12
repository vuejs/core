import { getCompiledString } from './utils'

describe('insertion anchors', () => {
  describe('prepend', () => {
    test('prepend anchor with component', () => {
      expect(
        getCompiledString('<div><Comp/><Comp/><span/></div>', { vapor: true }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--[p-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--p]--><!--[p-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--p]--><span></span></div>\`"
      `)
    })

    test('prepend anchor with component in ssr slot vnode fallback', () => {
      expect(
        getCompiledString(
          `<component :is="'div'">
            <div>
              <Comp/><Comp/><span/>
            </div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--[p-->\`)
                _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
                _push(\`<!--p]--><!--[p-->\`)
                _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
                _push(\`<!--p]--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("[p"),
                    _createVNode(_component_Comp),
                    _createCommentVNode("p]"),
                    _createCommentVNode("[p"),
                    _createVNode(_component_Comp),
                    _createCommentVNode("p]"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })

    test('prepend anchor with slot', () => {
      expect(
        getCompiledString('<div><slot name="foo"/><slot/><span/></div>', {
          vapor: true,
        }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--[p-->\`)
          _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent)
          _push(\`<!--slot--><!--p]--><!--[p-->\`)
          _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent)
          _push(\`<!--slot--><!--p]--><span></span></div>\`"
      `)
    })

    test('prepend anchor with slot in ssr slot vnode fallback', () => {
      expect(
        getCompiledString(
          `<component :is="'div'">
            <div>
              <slot name="foo"/>
              <slot/>
              <span/>
            </div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--[p-->\`)
                _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent, _scopeId)
                _push(\`<!--slot--><!--p]--><!--[p-->\`)
                _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId)
                _push(\`<!--slot--><!--p]--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("[p"),
                    _renderSlot(_ctx.$slots, "foo"),
                    _createCommentVNode("p]"),
                    _createCommentVNode("[p"),
                    _renderSlot(_ctx.$slots, "default"),
                    _createCommentVNode("p]"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 3 /* FORWARDED */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })

    test('prepend anchor with v-if/else-if/else', () => {
      expect(
        getCompiledString(
          `<div>
            <span v-if="foo"/>
            <span v-else-if="bar"/>
            <span v-else/>
            <span/>
          </div>`,
          {
            vapor: true,
          },
        ),
      ).toMatchInlineSnapshot(`
        "\`<div><!--[p-->\`)
          if (_ctx.foo) {
            _push(\`<span></span>\`)
            _push(\`<!--if-->\`)
          } else if (_ctx.bar) {
            _push(\`<span></span>\`)
            _push(\`<!--if--><!--if-->\`)
          } else {
            _push(\`<span></span>\`)
            _push(\`<!--if--><!--if-->\`)
          }
          _push(\`<!--p]--><span></span></div>\`"
      `)
    })

    test('prepend anchor with v-if/else-if/else in ssr slot vnode fallback', () => {
      expect(
        getCompiledString(
          `<component :is="'div'">
            <div>
              <span v-if="foo"/>
              <span v-else-if="bar"/>
              <span v-else/>
              <span/>
            </div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--[p-->\`)
                if (_ctx.foo) {
                  _push(\`<span\${_scopeId}></span>\`)
                  _push(\`<!--if-->\`)
                } else if (_ctx.bar) {
                  _push(\`<span\${_scopeId}></span>\`)
                  _push(\`<!--if--><!--if-->\`)
                } else {
                  _push(\`<span\${_scopeId}></span>\`)
                  _push(\`<!--if--><!--if-->\`)
                }
                _push(\`<!--p]--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("[p"),
                    (_ctx.foo)
                      ? (_openBlock(), _createBlock("span", { key: 0 }))
                      : (_ctx.bar)
                        ? (_openBlock(), _createBlock("span", { key: 1 }))
                        : (_openBlock(), _createBlock("span", { key: 2 })),
                    _createCommentVNode("p]"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })

    test('prepend anchor with nested v-if', () => {
      expect(
        getCompiledString(
          `<div>
            <span v-if="foo">
              <span v-if="foo1" />
              <span />
            </span>
            <span v-else-if="bar">
              <span v-if="bar1" />
              <span />
            </span>
            <span v-else>
              <span v-if="bar2" />
              <span />
            </span>
            <span />
          </div>`,
          {
            vapor: true,
          },
        ),
      ).toMatchInlineSnapshot(`
        "\`<div><!--[p-->\`)
          if (_ctx.foo) {
            _push(\`<span><!--[p-->\`)
            if (_ctx.foo1) {
              _push(\`<span></span>\`)
              _push(\`<!--if-->\`)
            } else {
              _push(\`<!---->\`)
            }
            _push(\`<!--p]--><span></span></span>\`)
            _push(\`<!--if-->\`)
          } else if (_ctx.bar) {
            _push(\`<span><!--[p-->\`)
            if (_ctx.bar1) {
              _push(\`<span></span>\`)
              _push(\`<!--if-->\`)
            } else {
              _push(\`<!---->\`)
            }
            _push(\`<!--p]--><span></span></span>\`)
            _push(\`<!--if--><!--if-->\`)
          } else {
            _push(\`<span><!--[p-->\`)
            if (_ctx.bar2) {
              _push(\`<span></span>\`)
              _push(\`<!--if-->\`)
            } else {
              _push(\`<!---->\`)
            }
            _push(\`<!--p]--><span></span></span>\`)
            _push(\`<!--if--><!--if-->\`)
          }
          _push(\`<!--p]--><span></span></div>\`"
      `)
    })

    test('prepend anchor with nested v-if in ssr slot vnode fallback', () => {
      expect(
        getCompiledString(
          `<component :is="'div'">
            <div>
              <span v-if="foo">
                <span v-if="foo1" />
                <span />
              </span>
              <span v-else-if="bar">
                <span v-if="bar1" />
                <span />
              </span>
              <span v-else>
                <span v-if="bar2" />
                <span />
              </span>
              <span />
            </div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--[p-->\`)
                if (_ctx.foo) {
                  _push(\`<span\${_scopeId}><!--[p-->\`)
                  if (_ctx.foo1) {
                    _push(\`<span\${_scopeId}></span>\`)
                    _push(\`<!--if-->\`)
                  } else {
                    _push(\`<!---->\`)
                  }
                  _push(\`<!--p]--><span\${_scopeId}></span></span>\`)
                  _push(\`<!--if-->\`)
                } else if (_ctx.bar) {
                  _push(\`<span\${_scopeId}><!--[p-->\`)
                  if (_ctx.bar1) {
                    _push(\`<span\${_scopeId}></span>\`)
                    _push(\`<!--if-->\`)
                  } else {
                    _push(\`<!---->\`)
                  }
                  _push(\`<!--p]--><span\${_scopeId}></span></span>\`)
                  _push(\`<!--if--><!--if-->\`)
                } else {
                  _push(\`<span\${_scopeId}><!--[p-->\`)
                  if (_ctx.bar2) {
                    _push(\`<span\${_scopeId}></span>\`)
                    _push(\`<!--if-->\`)
                  } else {
                    _push(\`<!---->\`)
                  }
                  _push(\`<!--p]--><span\${_scopeId}></span></span>\`)
                  _push(\`<!--if--><!--if-->\`)
                }
                _push(\`<!--p]--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("[p"),
                    (_ctx.foo)
                      ? (_openBlock(), _createBlock("span", { key: 0 }, [
                          _createCommentVNode("[p"),
                          (_ctx.foo1)
                            ? (_openBlock(), _createBlock("span", { key: 0 }))
                            : _createCommentVNode("v-if", true),
                          _createCommentVNode("p]"),
                          _createVNode("span")
                        ]))
                      : (_ctx.bar)
                        ? (_openBlock(), _createBlock("span", { key: 1 }, [
                            _createCommentVNode("[p"),
                            (_ctx.bar1)
                              ? (_openBlock(), _createBlock("span", { key: 0 }))
                              : _createCommentVNode("v-if", true),
                            _createCommentVNode("p]"),
                            _createVNode("span")
                          ]))
                        : (_openBlock(), _createBlock("span", { key: 2 }, [
                            _createCommentVNode("[p"),
                            (_ctx.bar2)
                              ? (_openBlock(), _createBlock("span", { key: 0 }))
                              : _createCommentVNode("v-if", true),
                            _createCommentVNode("p]"),
                            _createVNode("span")
                          ])),
                    _createCommentVNode("p]"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })

    test('prepend anchor with template v-if', () => {
      expect(
        getCompiledString(
          `<component :is="tag">
            <div v-if="foo">
              <template v-if="depth < 5">
                foo
              </template>
              <div></div>
            </div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent(_ctx.tag), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                if (_ctx.foo) {
                  _push(\`<div\${_scopeId}><!--[p-->\`)
                  if (_ctx.depth < 5) {
                    _push(\`<!--[--> foo <!--]-->\`)
                    _push(\`<!--if-->\`)
                  } else {
                    _push(\`<!---->\`)
                  }
                  _push(\`<!--p]--><div\${_scopeId}></div></div>\`)
                  _push(\`<!--if-->\`)
                } else {
                  _push(\`<!---->\`)
                }
              } else {
                return [
                  (_ctx.foo)
                    ? (_openBlock(), _createBlock("div", { key: 0 }, [
                        _createCommentVNode("[p"),
                        (_ctx.depth < 5)
                          ? (_openBlock(), _createBlock(_Fragment, { key: 0 }, [
                              _createTextVNode(" foo ")
                            ], 64 /* STABLE_FRAGMENT */))
                          : _createCommentVNode("v-if", true),
                        _createCommentVNode("p]"),
                        _createVNode("div")
                      ]))
                    : _createCommentVNode("v-if", true)
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })

    test('prepend anchor with v-for', () => {
      expect(
        getCompiledString('<div><span v-for="item in items"/><span/></div>', {
          vapor: true,
        }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--[p--><!--[-->\`)
          _ssrRenderList(_ctx.items, (item) => {
            _push(\`<span></span>\`)
          })
          _push(\`<!--]--><!--for--><!--p]--><span></span></div>\`"
      `)
    })

    test('prepend anchor with v-for in ssr slot vnode fallback', () => {
      expect(
        getCompiledString(
          `<component :is="'div'">
            <div>
              <span v-for="item in items"/><span/>
            </div>
          </component>`,
          { vapor: true },
        ),
      ).toMatchInlineSnapshot(`
        "\`<!--[a-->\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--[p--><!--[-->\`)
                _ssrRenderList(_ctx.items, (item) => {
                  _push(\`<span\${_scopeId}></span>\`)
                })
                _push(\`<!--]--><!--for--><!--p]--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("[p"),
                    (_openBlock(true), _createBlock(_Fragment, null, _renderList(_ctx.items, (item) => {
                      return (_openBlock(), _createBlock("span"))
                    }), 256 /* UNKEYED_FRAGMENT */)),
                    _createCommentVNode("p]"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component--><!--a]-->\`"
      `)
    })
  })

  // TODO add more tests
  describe('insertion anchor', () => {
    test('insertion anchor with component', () => {
      expect(
        getCompiledString('<div><span/><Comp/><span/></div>', { vapor: true }),
      ).toMatchInlineSnapshot(`
        "\`<div><span></span><!--[i-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--i]--><span></span></div>\`"
      `)
    })
  })

  // TODO add more tests
  describe('append', () => {
    test('append anchor', () => {
      expect(
        getCompiledString('<div><span/><Comp/><Comp/></div>', { vapor: true }),
      ).toMatchInlineSnapshot(`
        "\`<div><span></span><!--[a-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--a]--><!--[a-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--a]--></div>\`"
      `)
    })
  })

  test('mixed anchors', () => {
    expect(
      getCompiledString('<div><Comp/><span/><Comp/><span/><Comp/></div>', {
        vapor: true,
      }),
    ).toMatchInlineSnapshot(`
      "\`<div><!--[p-->\`)
        _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        _push(\`<!--p]--><span></span><!--[i-->\`)
        _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        _push(\`<!--i]--><span></span><!--[a-->\`)
        _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        _push(\`<!--a]--></div>\`"
    `)
  })

  test('mixed anchors in ssr slot vnode fallback', () => {
    expect(
      getCompiledString(
        `<component :is="'div'">
          <div>
            <Comp/><span/>
            <Comp/><span/>
            <Comp/>
          </div>
        </component>`,
        {
          vapor: true,
        },
      ),
    ).toMatchInlineSnapshot(`
      "\`<!--[a-->\`)
        _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<div\${_scopeId}><!--[p-->\`)
              _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
              _push(\`<!--p]--><span\${_scopeId}></span><!--[i-->\`)
              _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
              _push(\`<!--i]--><span\${_scopeId}></span><!--[a-->\`)
              _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
              _push(\`<!--a]--></div>\`)
            } else {
              return [
                _createVNode("div", null, [
                  _createCommentVNode("[p"),
                  _createVNode(_component_Comp),
                  _createCommentVNode("p]"),
                  _createVNode("span"),
                  _createCommentVNode("[i"),
                  _createVNode(_component_Comp),
                  _createCommentVNode("i]"),
                  _createVNode("span"),
                  _createCommentVNode("[a"),
                  _createVNode(_component_Comp),
                  _createCommentVNode("a]")
                ])
              ]
            }
          }),
          _: 1 /* STABLE */
        }), _parent)
        _push(\`<!--dynamic-component--><!--a]-->\`"
    `)
  })
})

describe('block anchors', () => {
  test('if', () => {
    expect(
      getCompiledString(
        `<span v-if="count === 1">1</span>
        <span v-else-if="count === 2">2</span>
        <span v-else-if="count === 3">3</span>
        <span v-else>4</span>`,
        {
          vapor: true,
        },
      ),
    ).toMatchInlineSnapshot(`
      "\`<!--[a-->\`)
        if (_ctx.count === 1) {
          _push(\`<span>1</span>\`)
          _push(\`<!--if-->\`)
        } else if (_ctx.count === 2) {
          _push(\`<span>2</span>\`)
          _push(\`<!--if--><!--if-->\`)
        } else if (_ctx.count === 3) {
          _push(\`<span>3</span>\`)
          _push(\`<!--if--><!--if--><!--if-->\`)
        } else {
          _push(\`<span>4</span>\`)
          _push(\`<!--if--><!--if--><!--if-->\`)
        }
        _push(\`<!--a]-->\`"
    `)
  })

  test('if in ssr slot vnode fallback', () => {})

  test('for', () => {})

  test('for in ssr slot vnode fallback', () => {})

  test('slot', () => {})

  test('slot in ssr slot vnode fallback', () => {})

  test('forwarded slot', () => {})

  test('dynamic component', () => {})

  test('dynamic in ssr slot vnode fallback', () => {})
})
