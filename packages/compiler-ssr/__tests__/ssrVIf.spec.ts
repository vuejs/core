import { compile } from '../src'

describe('ssr: v-if', () => {
  test('basic', () => {
    expect(compile(`<div v-if="foo"></div>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        let _temp0

        if (_ctx.foo) {
          _push(\`<div\${
            _ssrRenderAttrs(_temp0 = _attrs)
          }>\${
            ("textContent" in _temp0) ? _ssrInterpolate(_temp0.textContent) : _temp0.innerHTML ?? ''
          }</div>\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('with nested content', () => {
    expect(compile(`<div v-if="foo">hello<span>ok</span></div>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}>hello<span>ok</span></div>\`)
          } else {
            _push(\`<!---->\`)
          }
        }"
      `)
  })

  test('v-if + v-else', () => {
    expect(compile(`<div v-if="foo"/><span v-else/>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          let _temp0, _temp1

          if (_ctx.foo) {
            _push(\`<div\${
              _ssrRenderAttrs(_temp0 = _attrs)
            }>\${
              ("textContent" in _temp0) ? _ssrInterpolate(_temp0.textContent) : _temp0.innerHTML ?? ''
            }</div>\`)
          } else {
            _push(\`<span\${
              _ssrRenderAttrs(_temp1 = _attrs)
            }>\${
              ("textContent" in _temp1) ? _ssrInterpolate(_temp1.textContent) : _temp1.innerHTML ?? ''
            }</span>\`)
          }
        }"
      `)
  })

  test('v-if + v-else-if', () => {
    expect(compile(`<div v-if="foo"/><span v-else-if="bar"/>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          let _temp0, _temp1

          if (_ctx.foo) {
            _push(\`<div\${
              _ssrRenderAttrs(_temp0 = _attrs)
            }>\${
              ("textContent" in _temp0) ? _ssrInterpolate(_temp0.textContent) : _temp0.innerHTML ?? ''
            }</div>\`)
          } else if (_ctx.bar) {
            _push(\`<span\${
              _ssrRenderAttrs(_temp1 = _attrs)
            }>\${
              ("textContent" in _temp1) ? _ssrInterpolate(_temp1.textContent) : _temp1.innerHTML ?? ''
            }</span>\`)
          } else {
            _push(\`<!---->\`)
          }
        }"
      `)
  })

  test('v-if + v-else-if + v-else', () => {
    expect(compile(`<div v-if="foo"/><span v-else-if="bar"/><p v-else/>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          let _temp0, _temp1, _temp2

          if (_ctx.foo) {
            _push(\`<div\${
              _ssrRenderAttrs(_temp0 = _attrs)
            }>\${
              ("textContent" in _temp0) ? _ssrInterpolate(_temp0.textContent) : _temp0.innerHTML ?? ''
            }</div>\`)
          } else if (_ctx.bar) {
            _push(\`<span\${
              _ssrRenderAttrs(_temp1 = _attrs)
            }>\${
              ("textContent" in _temp1) ? _ssrInterpolate(_temp1.textContent) : _temp1.innerHTML ?? ''
            }</span>\`)
          } else {
            _push(\`<p\${
              _ssrRenderAttrs(_temp2 = _attrs)
            }>\${
              ("textContent" in _temp2) ? _ssrInterpolate(_temp2.textContent) : _temp2.innerHTML ?? ''
            }</p>\`)
          }
        }"
      `)
  })

  test('<template v-if> (text)', () => {
    expect(compile(`<template v-if="foo">hello</template>`).code)
      .toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<!--[-->hello<!--]-->\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('<template v-if> (single element)', () => {
    // single element should not wrap with fragment
    expect(compile(`<template v-if="foo"><div>hi</div></template>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}>hi</div>\`)
          } else {
            _push(\`<!---->\`)
          }
        }"
      `)
  })

  test('<template v-if> (multiple element)', () => {
    expect(
      compile(`<template v-if="foo"><div>hi</div><div>ho</div></template>`)
        .code,
    ).toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<!--[--><div>hi</div><div>ho</div><!--]-->\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('<template v-if> (with v-for inside)', () => {
    expect(
      compile(`<template v-if="foo"><div v-for="i in list"/></template>`).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<!--[-->\`)
          _ssrRenderList(_ctx.list, (i) => {
            _push(\`<div></div>\`)
          })
          _push(\`<!--]-->\`)
        } else {
          _push(\`<!---->\`)
        }
      }"
    `)
  })

  test('<template v-if> + normal v-else', () => {
    expect(
      compile(
        `<template v-if="foo"><div>hi</div><div>ho</div></template><div v-else/>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        let _temp0

        if (_ctx.foo) {
          _push(\`<!--[--><div>hi</div><div>ho</div><!--]-->\`)
        } else {
          _push(\`<div\${
            _ssrRenderAttrs(_temp0 = _attrs)
          }>\${
            ("textContent" in _temp0) ? _ssrInterpolate(_temp0.textContent) : _temp0.innerHTML ?? ''
          }</div>\`)
        }
      }"
    `)
  })
})
