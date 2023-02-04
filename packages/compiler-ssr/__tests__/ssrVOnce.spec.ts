import { compile } from '../src'

describe('ssr: v-once', () => {
  test('basic', () => {
    expect(compile(`<v-app><v-main v-once /></v-app>`).code)
      .toMatchInlineSnapshot(`
      "const { resolveComponent: _resolveComponent, withCtx: _withCtx, setBlockTracking: _setBlockTracking, createVNode: _createVNode } = require(\\"vue\\")
      const { ssrRenderComponent: _ssrRenderComponent } = require(\\"vue/server-renderer\\")

      return function ssrRender(_ctx, _push, _parent, _attrs, _cache) {
        const _component_v_app = _resolveComponent(\\"v-app\\")
        const _component_v_main = _resolveComponent(\\"v-main\\")

        _push(_ssrRenderComponent(_component_v_app, _attrs, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(_ssrRenderComponent(_component_v_main, null, null, _parent, _scopeId))
            } else {
              return [
                _cache[0] || (
                  _setBlockTracking(-1),
                  _cache[0] = _createVNode(_component_v_main),
                  _setBlockTracking(1),
                  _cache[0]
                )
              ]
            }
          }),
          _: 1 /* STABLE */
        }, _parent))
      }"
    `)
  })
})
