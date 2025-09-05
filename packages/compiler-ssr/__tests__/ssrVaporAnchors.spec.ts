import { getCompiledString } from './utils'

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
      "\`<div>\`)
        _ssrRenderSlot(_ctx.$slots, "foo", {}, null, _push, _parent)
        _push(\`<!--slot-->\`)
        _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent)
        _push(\`<!--slot--></div>\`"
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
