import { compile } from '../src'

describe('ssr: v-bind', () => {
  test('basic', () => {
    expect(compile(`<div :id="id"/>`).code).toMatchInlineSnapshot(`
      "const { _renderAttr } = require(\\"vue\\")

      return function ssrRender(_ctx, _push, _parent) {
        _push(\`<div\${_renderAttr(\\"id\\", _ctx.id)}></div>\`)
      }"
    `)
  })
})
