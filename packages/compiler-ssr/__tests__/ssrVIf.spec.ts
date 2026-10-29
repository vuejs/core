import { compile } from '../src'

describe('ssr: v-if', () => {
  test('basic', () => {
    expect(compile(`<div v-if="foo"></div>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
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
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          } else {
            _push(\`<span\${_ssrRenderAttrs(_attrs)}></span>\`)
          }
        }"
      `)
  })

  test('v-if + v-else-if', () => {
    expect(compile(`<div v-if="foo"/><span v-else-if="bar"/>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          } else if (_ctx.bar) {
            _push(\`<span\${_ssrRenderAttrs(_attrs)}></span>\`)
          } else {
            _push(\`<!---->\`)
          }
        }"
      `)
  })

  test('v-if + v-else-if + v-else', () => {
    expect(compile(`<div v-if="foo"/><span v-else-if="bar"/><p v-else/>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.foo) {
            _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
          } else if (_ctx.bar) {
            _push(\`<span\${_ssrRenderAttrs(_attrs)}></span>\`)
          } else {
            _push(\`<p\${_ssrRenderAttrs(_attrs)}></p>\`)
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
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        if (_ctx.foo) {
          _push(\`<!--[--><div>hi</div><div>ho</div><!--]-->\`)
        } else {
          _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
        }
      }"
    `)
  })
})

// vapor: a chain whose branches could start with the same node wraps the
// branch it renders in `<!--[i-->`…`<!--]-->`, i being the branch's position
describe('ssr: v-if branch ranges (vapor)', () => {
  const vapor = (src: string) => compile(src, { vapor: true }).code

  test('same-tag branches', () => {
    expect(vapor(`<div v-if="a"><p>a</p></div><div v-else><b>b</b></div>`))
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.a) {
            _push(\`<!--[0--><div\${_ssrRenderAttrs(_attrs)}><p>a</p></div><!--]-->\`)
          } else {
            _push(\`<!--[1--><div\${_ssrRenderAttrs(_attrs)}><b>b</b></div><!--]-->\`)
          }
        }"
      `)
  })

  test('a component branch, a v-else-if and no branch', () => {
    const code = vapor(
      `<section><Comp v-if="a"/><div v-else-if="b">B</div></section>`,
    )
    expect(code).toContain('_push(`<!--[0-->`)')
    expect(code).toContain('_push(`<!--[1--><div>B</div><!--]-->`)')
    expect(code).toContain('_push(`<!---->`)')
  })

  test('a multi-root branch and an empty one', () => {
    const code = vapor(
      `<template v-if="a"><p>1</p><p>2</p></template><template v-else></template>`,
    )
    expect(code).toContain('<!--[0--><p>1</p><p>2</p><!--]-->')
    expect(code).toContain('<!--[1--><!--]-->')
    expect(code).not.toContain('<!--[-->')
  })

  test('branches under a transition', () => {
    const code = vapor(
      `<Transition><div v-if="a">A</div><div v-else>B</div></Transition>`,
    )
    expect(code).toContain('<!--[0--><div>A</div><!--]-->')
    expect(code).toContain('<!--[1--><div>B</div><!--]-->')
  })

  test.each([
    ['a v-if alone', `<div v-if="a">A</div>`, true],
    [
      'branches of different tags',
      `<div v-if="a">A</div><p v-else>B</p>`,
      true,
    ],
    ['the vdom output', `<div v-if="a">A</div><div v-else>B</div>`, false],
  ])('none for %s', (_, src, isVapor) => {
    expect(compile(src, { vapor: isVapor }).code).not.toMatch(/<!--\[\d/)
  })
})
