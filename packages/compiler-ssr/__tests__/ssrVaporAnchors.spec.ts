import { getCompiledString } from './utils'

describe('block anchors', () => {
  describe('prepend', () => {
    test('prepend anchor with component', () => {
      expect(
        getCompiledString('<div><Comp/><Comp/><span/></div>', { vapor: true }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--{-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--}--><!--{-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--}--><span></span></div>\`"
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
        "\`\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--{-->\`)
                _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
                _push(\`<!--}--><!--{-->\`)
                _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
                _push(\`<!--}--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("{"),
                    _createVNode(_component_Comp),
                    _createCommentVNode("}"),
                    _createCommentVNode("{"),
                    _createVNode(_component_Comp),
                    _createCommentVNode("}"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component-->\`"
      `)
    })

    test('prepend anchor with slot', () => {
      expect(
        getCompiledString('<div><slot name="foo"/><slot/><span/></div>', {
          vapor: true,
        }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--{-->\`)
          _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent)
          _push(\`<!--slot--><!--}--><!--{-->\`)
          _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent)
          _push(\`<!--slot--><!--}--><span></span></div>\`"
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
        "\`\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--{-->\`)
                _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent, _scopeId)
                _push(\`<!--slot--><!--}--><!--{-->\`)
                _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId)
                _push(\`<!--slot--><!--}--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("{"),
                    _renderSlot(_ctx.$slots, "foo"),
                    _createCommentVNode("slot"),
                    _createCommentVNode("}"),
                    _createCommentVNode("{"),
                    _renderSlot(_ctx.$slots, "default"),
                    _createCommentVNode("slot"),
                    _createCommentVNode("}"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 3 /* FORWARDED */
          }), _parent)
          _push(\`<!--dynamic-component-->\`"
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
        "\`<div><!--{-->\`)
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
          _push(\`<!--}--><span></span></div>\`"
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
        "\`\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--{-->\`)
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
                _push(\`<!--}--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("{"),
                    (_ctx.foo)
                      ? (_openBlock(), _createBlock(_Fragment, { key: 0 }, [
                          _createVNode("span"),
                          _createCommentVNode("<!--if-->")
                        ], 64 /* STABLE_FRAGMENT */))
                      : (_ctx.bar)
                        ? (_openBlock(), _createBlock(_Fragment, { key: 1 }, [
                            _createVNode("span"),
                            _createCommentVNode("<!--if--><!--if-->")
                          ], 64 /* STABLE_FRAGMENT */))
                        : (_openBlock(), _createBlock(_Fragment, { key: 2 }, [
                            _createVNode("span"),
                            _createCommentVNode("<!--if--><!--if-->")
                          ], 64 /* STABLE_FRAGMENT */)),
                    _createCommentVNode("}"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component-->\`"
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
        "\`<div><!--{-->\`)
          if (_ctx.foo) {
            _push(\`<span><!--{-->\`)
            if (_ctx.foo1) {
              _push(\`<span></span>\`)
              _push(\`<!--if-->\`)
            } else {
              _push(\`<!--if-->\`)
            }
            _push(\`<!--}--><span></span></span>\`)
            _push(\`<!--if-->\`)
          } else if (_ctx.bar) {
            _push(\`<span><!--{-->\`)
            if (_ctx.bar1) {
              _push(\`<span></span>\`)
              _push(\`<!--if-->\`)
            } else {
              _push(\`<!--if-->\`)
            }
            _push(\`<!--}--><span></span></span>\`)
            _push(\`<!--if--><!--if-->\`)
          } else {
            _push(\`<span><!--{-->\`)
            if (_ctx.bar2) {
              _push(\`<span></span>\`)
              _push(\`<!--if-->\`)
            } else {
              _push(\`<!--if-->\`)
            }
            _push(\`<!--}--><span></span></span>\`)
            _push(\`<!--if--><!--if-->\`)
          }
          _push(\`<!--}--><span></span></div>\`"
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
        "\`\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--{-->\`)
                if (_ctx.foo) {
                  _push(\`<span\${_scopeId}><!--{-->\`)
                  if (_ctx.foo1) {
                    _push(\`<span\${_scopeId}></span>\`)
                    _push(\`<!--if-->\`)
                  } else {
                    _push(\`<!--if-->\`)
                  }
                  _push(\`<!--}--><span\${_scopeId}></span></span>\`)
                  _push(\`<!--if-->\`)
                } else if (_ctx.bar) {
                  _push(\`<span\${_scopeId}><!--{-->\`)
                  if (_ctx.bar1) {
                    _push(\`<span\${_scopeId}></span>\`)
                    _push(\`<!--if-->\`)
                  } else {
                    _push(\`<!--if-->\`)
                  }
                  _push(\`<!--}--><span\${_scopeId}></span></span>\`)
                  _push(\`<!--if--><!--if-->\`)
                } else {
                  _push(\`<span\${_scopeId}><!--{-->\`)
                  if (_ctx.bar2) {
                    _push(\`<span\${_scopeId}></span>\`)
                    _push(\`<!--if-->\`)
                  } else {
                    _push(\`<!--if-->\`)
                  }
                  _push(\`<!--}--><span\${_scopeId}></span></span>\`)
                  _push(\`<!--if--><!--if-->\`)
                }
                _push(\`<!--}--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("{"),
                    (_ctx.foo)
                      ? (_openBlock(), _createBlock(_Fragment, { key: 0 }, [
                          _createVNode("span", null, [
                            _createCommentVNode("{"),
                            (_ctx.foo1)
                              ? (_openBlock(), _createBlock("span", { key: 0 }))
                              : _createCommentVNode("v-if", true),
                            _createCommentVNode("if"),
                            _createCommentVNode("}"),
                            _createVNode("span")
                          ]),
                          _createCommentVNode("<!--if-->")
                        ], 64 /* STABLE_FRAGMENT */))
                      : (_ctx.bar)
                        ? (_openBlock(), _createBlock(_Fragment, { key: 1 }, [
                            _createVNode("span", null, [
                              _createCommentVNode("{"),
                              (_ctx.bar1)
                                ? (_openBlock(), _createBlock("span", { key: 0 }))
                                : _createCommentVNode("v-if", true),
                              _createCommentVNode("if"),
                              _createCommentVNode("}"),
                              _createVNode("span")
                            ]),
                            _createCommentVNode("<!--if--><!--if-->")
                          ], 64 /* STABLE_FRAGMENT */))
                        : (_openBlock(), _createBlock(_Fragment, { key: 2 }, [
                            _createVNode("span", null, [
                              _createCommentVNode("{"),
                              (_ctx.bar2)
                                ? (_openBlock(), _createBlock("span", { key: 0 }))
                                : _createCommentVNode("v-if", true),
                              _createCommentVNode("if"),
                              _createCommentVNode("}"),
                              _createVNode("span")
                            ]),
                            _createCommentVNode("<!--if--><!--if-->")
                          ], 64 /* STABLE_FRAGMENT */)),
                    _createCommentVNode("}"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component-->\`"
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
        "\`\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent(_ctx.tag), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                if (_ctx.foo) {
                  _push(\`<div\${_scopeId}><!--{-->\`)
                  if (_ctx.depth < 5) {
                    _push(\` foo \`)
                    _push(\`<!--if-->\`)
                  } else {
                    _push(\`<!--if-->\`)
                  }
                  _push(\`<!--}--><div\${_scopeId}></div></div>\`)
                  _push(\`<!--if-->\`)
                } else {
                  _push(\`<!--if-->\`)
                }
              } else {
                return [
                  (_ctx.foo)
                    ? (_openBlock(), _createBlock("div", { key: 0 }, [
                        _createCommentVNode("{"),
                        (_ctx.depth < 5)
                          ? (_openBlock(), _createBlock(_Fragment, { key: 0 }, [
                              _createTextVNode(" foo ")
                            ], 64 /* STABLE_FRAGMENT */))
                          : _createCommentVNode("v-if", true),
                        _createCommentVNode("if"),
                        _createCommentVNode("}"),
                        _createVNode("div")
                      ]))
                    : _createCommentVNode("v-if", true),
                  _createCommentVNode("if")
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component-->\`"
      `)
    })

    test('prepend anchor with v-for', () => {
      expect(
        getCompiledString('<div><span v-for="item in items"/><span/></div>', {
          vapor: true,
        }),
      ).toMatchInlineSnapshot(`
        "\`<div><!--{-->\`)
          _ssrRenderList(_ctx.items, (item) => {
            _push(\`<span></span>\`)
          })
          _push(\`<!--for--><!--}--><span></span></div>\`"
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
        "\`\`)
          _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
            default: _withCtx((_, _push, _parent, _scopeId) => {
              if (_push) {
                _push(\`<div\${_scopeId}><!--{-->\`)
                _ssrRenderList(_ctx.items, (item) => {
                  _push(\`<span\${_scopeId}></span>\`)
                })
                _push(\`<!--for--><!--}--><span\${_scopeId}></span></div>\`)
              } else {
                return [
                  _createVNode("div", null, [
                    _createCommentVNode("{"),
                    (_openBlock(true), _createBlock(_Fragment, null, _renderList(_ctx.items, (item) => {
                      return (_openBlock(), _createBlock("span"))
                    }), 256 /* UNKEYED_FRAGMENT */)),
                    _createCommentVNode("for"),
                    _createCommentVNode("}"),
                    _createVNode("span")
                  ])
                ]
              }
            }),
            _: 1 /* STABLE */
          }), _parent)
          _push(\`<!--dynamic-component-->\`"
      `)
    })
  })

  // TODO add more tests
  describe('insert', () => {
    test('insertion anchor with component', () => {
      expect(
        getCompiledString('<div><span/><Comp/><span/></div>', { vapor: true }),
      ).toMatchInlineSnapshot(`
        "\`<div><span></span><!--{-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--}--><span></span></div>\`"
      `)
    })
  })

  // TODO add more tests
  describe('append', () => {
    test('append anchor', () => {
      expect(
        getCompiledString('<div><span/><Comp/><Comp/></div>', { vapor: true }),
      ).toMatchInlineSnapshot(`
        "\`<div><span></span><!--{-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--}--><!--{-->\`)
          _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
          _push(\`<!--}--></div>\`"
      `)
    })
  })

  test('mixed anchors', () => {
    expect(
      getCompiledString('<div><Comp/><span/><Comp/><span/><Comp/></div>', {
        vapor: true,
      }),
    ).toMatchInlineSnapshot(`
      "\`<div><!--{-->\`)
        _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        _push(\`<!--}--><span></span><!--{-->\`)
        _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        _push(\`<!--}--><span></span><!--{-->\`)
        _push(_ssrRenderComponent(_component_Comp, null, null, _parent))
        _push(\`<!--}--></div>\`"
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
      "\`\`)
        _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent('div'), null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<div\${_scopeId}><!--{-->\`)
              _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
              _push(\`<!--}--><span\${_scopeId}></span><!--{-->\`)
              _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
              _push(\`<!--}--><span\${_scopeId}></span><!--{-->\`)
              _push(_ssrRenderComponent(_component_Comp, null, null, _parent, _scopeId))
              _push(\`<!--}--></div>\`)
            } else {
              return [
                _createVNode("div", null, [
                  _createCommentVNode("{"),
                  _createVNode(_component_Comp),
                  _createCommentVNode("}"),
                  _createVNode("span"),
                  _createCommentVNode("{"),
                  _createVNode(_component_Comp),
                  _createCommentVNode("}"),
                  _createVNode("span"),
                  _createCommentVNode("{"),
                  _createVNode(_component_Comp),
                  _createCommentVNode("}")
                ])
              ]
            }
          }),
          _: 1 /* STABLE */
        }), _parent)
        _push(\`<!--dynamic-component-->\`"
    `)
  })
})

describe('fragment anchors', () => {
  test('if', () => {
    expect(
      getCompiledString(
        `<component :is="tag">
          <span v-if="count === 1">1</span>
          <span v-else-if="count === 2">2</span>
          <span v-else-if="count === 3">3</span>
          <span v-else>4</span>
        </component>`,
        {
          vapor: true,
        },
      ),
    ).toMatchInlineSnapshot(`
      "\`\`)
        _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent(_ctx.tag), null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              if (_ctx.count === 1) {
                _push(\`<span\${_scopeId}>1</span>\`)
                _push(\`<!--if-->\`)
              } else if (_ctx.count === 2) {
                _push(\`<span\${_scopeId}>2</span>\`)
                _push(\`<!--if--><!--if-->\`)
              } else if (_ctx.count === 3) {
                _push(\`<span\${_scopeId}>3</span>\`)
                _push(\`<!--if--><!--if--><!--if-->\`)
              } else {
                _push(\`<span\${_scopeId}>4</span>\`)
                _push(\`<!--if--><!--if--><!--if-->\`)
              }
            } else {
              return [
                (_ctx.count === 1)
                  ? (_openBlock(), _createBlock(_Fragment, { key: 0 }, [
                      _createVNode("span", null, "1"),
                      _createCommentVNode("<!--if-->")
                    ], 64 /* STABLE_FRAGMENT */))
                  : (_ctx.count === 2)
                    ? (_openBlock(), _createBlock(_Fragment, { key: 1 }, [
                        _createVNode("span", null, "2"),
                        _createCommentVNode("<!--if--><!--if-->")
                      ], 64 /* STABLE_FRAGMENT */))
                    : (_ctx.count === 3)
                      ? (_openBlock(), _createBlock(_Fragment, { key: 2 }, [
                          _createVNode("span", null, "3"),
                          _createCommentVNode("<!--if--><!--if--><!--if-->")
                        ], 64 /* STABLE_FRAGMENT */))
                      : (_openBlock(), _createBlock(_Fragment, { key: 3 }, [
                          _createVNode("span", null, "4"),
                          _createCommentVNode("<!--if--><!--if--><!--if-->")
                        ], 64 /* STABLE_FRAGMENT */))
              ]
            }
          }),
          _: 1 /* STABLE */
        }), _parent)
        _push(\`<!--dynamic-component-->\`"
    `)
  })

  test('if + v-html/v-text', () => {
    expect(
      getCompiledString(
        `<component :is="tag">
          <span v-if="count === 1" v-html="html"></span>
          <span v-else-if="count === 2" v-text="txt"></span>
          <span v-else>4</span>
        </component>`,
        {
          vapor: true,
        },
      ),
    ).toMatchInlineSnapshot(`
      "\`\`)
        _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent(_ctx.tag), null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              if (_ctx.count === 1) {
                _push(\`<span\${
                  _scopeId
                }>\${
                  (_ctx.html) ?? ''
                }</span>\`)
                _push(\`<!--if-->\`)
              } else if (_ctx.count === 2) {
                _push(\`<span\${
                  _scopeId
                }>\${
                  _ssrInterpolate(_ctx.txt)
                }</span>\`)
                _push(\`<!--if--><!--if-->\`)
              } else {
                _push(\`<span\${_scopeId}>4</span>\`)
                _push(\`<!--if--><!--if-->\`)
              }
            } else {
              return [
                (_ctx.count === 1)
                  ? (_openBlock(), _createBlock(_Fragment, { key: 0 }, [
                      _createVNode("span", { innerHTML: _ctx.html }, null, 8 /* PROPS */, ["innerHTML"]),
                      _createCommentVNode("<!--if-->")
                    ], 64 /* STABLE_FRAGMENT */))
                  : (_ctx.count === 2)
                    ? (_openBlock(), _createBlock(_Fragment, { key: 1 }, [
                        _createVNode("span", {
                          textContent: _toDisplayString(_ctx.txt)
                        }, null, 8 /* PROPS */, ["textContent"]),
                        _createCommentVNode("<!--if--><!--if-->")
                      ], 64 /* STABLE_FRAGMENT */))
                    : (_openBlock(), _createBlock(_Fragment, { key: 2 }, [
                        _createVNode("span", null, "4"),
                        _createCommentVNode("<!--if--><!--if-->")
                      ], 64 /* STABLE_FRAGMENT */))
              ]
            }
          }),
          _: 1 /* STABLE */
        }), _parent)
        _push(\`<!--dynamic-component-->\`"
    `)
  })

  test('for', () => {
    expect(
      getCompiledString(
        `<component :is="tag">
          <span v-for="item in items">{{item}}</span>
        </component>`,
        {
          vapor: true,
        },
      ),
    ).toMatchInlineSnapshot(`
      "\`\`)
        _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent(_ctx.tag), null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _ssrRenderList(_ctx.items, (item) => {
                _push(\`<span\${
                  _scopeId
                }>\${
                  _ssrInterpolate(item)
                }</span>\`)
              })
              _push(\`<!--for-->\`)
            } else {
              return [
                (_openBlock(true), _createBlock(_Fragment, null, _renderList(_ctx.items, (item) => {
                  return (_openBlock(), _createBlock("span", null, _toDisplayString(item), 1 /* TEXT */))
                }), 256 /* UNKEYED_FRAGMENT */)),
                _createCommentVNode("for")
              ]
            }
          }),
          _: 1 /* STABLE */
        }), _parent)
        _push(\`<!--dynamic-component-->\`"
    `)
  })

  test('slot', () => {
    expect(
      getCompiledString(
        `<div>
          <slot name="foo"/>
          <slot/>
        </div>`,
        { vapor: true },
      ),
    ).toMatchInlineSnapshot(`
      "\`<div><!--{-->\`)
        _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent)
        _push(\`<!--slot--><!--}--><!--{-->\`)
        _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent)
        _push(\`<!--slot--><!--}--></div>\`"
    `)
  })

  test('forwarded slot', () => {
    expect(
      getCompiledString(
        `<component :is="tag">
          <slot name="foo"/>
          <slot/>
        </component>`,
        { vapor: true },
      ),
    ).toMatchInlineSnapshot(`
      "\`\`)
        _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent(_ctx.tag), null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent, _scopeId)
              _push(\`<!--slot-->\`)
              _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId)
              _push(\`<!--slot-->\`)
            } else {
              return [
                _renderSlot(_ctx.$slots, "foo"),
                _createCommentVNode("slot"),
                _renderSlot(_ctx.$slots, "default"),
                _createCommentVNode("slot")
              ]
            }
          }),
          _: 3 /* FORWARDED */
        }), _parent)
        _push(\`<!--dynamic-component-->\`"
    `)
  })

  test('dynamic component', () => {
    expect(
      getCompiledString(
        `<component is='tag'>
          <div>
            <component is="foo"/>
          </div>
        </component>`,
        { vapor: true },
      ),
    ).toMatchInlineSnapshot(`
      "\`\`)
        _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent("tag"), null, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<div\${_scopeId}>\`)
              _ssrRenderVNode(_push, _createVNode(_resolveDynamicComponent("foo"), null, null), _parent, _scopeId)
              _push(\`<!--dynamic-component--></div>\`)
            } else {
              return [
                _createVNode("div", null, [
                  (_openBlock(), _createBlock(_resolveDynamicComponent("foo"))),
                  _createCommentVNode("dynamic-component")
                ])
              ]
            }
          }),
          _: 1 /* STABLE */
        }), _parent)
        _push(\`<!--dynamic-component-->\`"
    `)
  })
})
