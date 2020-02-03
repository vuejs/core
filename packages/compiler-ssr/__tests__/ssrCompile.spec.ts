import { compile } from '../src'

function getString(src: string): string {
  return compile(src).code.match(/_push\((.*)\)/)![1]
}

describe('element', () => {
  test('basic elements', () => {
    expect(getString(`<div></div>`)).toMatchInlineSnapshot(`"\`<div></div>\`"`)
    expect(getString(`<div/>`)).toMatchInlineSnapshot(`"\`<div></div>\`"`)
  })

  test('static attrs', () => {
    expect(getString(`<div id="foo" class="bar"></div>`)).toMatchInlineSnapshot(
      `"\`<div id=\\"foo\\" class=\\"bar\\"></div>\`"`
    )
  })

  test('nested elements', () => {
    expect(
      getString(`<div><span></span><span></span></div>`)
    ).toMatchInlineSnapshot(`"\`<div><span></span><span></span></div>\`"`)
  })

  test('void element', () => {
    expect(getString(`<input>`)).toMatchInlineSnapshot(`"\`<input>\`"`)
  })
})

describe('text', () => {
  test('static text', () => {
    expect(getString(`foo`)).toMatchInlineSnapshot(`"\`foo\`"`)
  })

  test('static text escape', () => {
    expect(getString(`&lt;foo&gt;`)).toMatchInlineSnapshot(`"\`&lt;foo&gt;\`"`)
  })

  test('nested elements with static text', () => {
    expect(
      getString(`<div><span>hello</span><span>bye</span></div>`)
    ).toMatchInlineSnapshot(
      `"\`<div><span>hello</span><span>bye</span></div>\`"`
    )
  })

  test('interpolation', () => {
    expect(getString(`foo {{ bar }} baz`)).toMatchInlineSnapshot(
      `"\`foo \${interpolate(_ctx.bar)} baz\`"`
    )
  })

  test('nested elements with interpolation', () => {
    expect(
      getString(
        `<div><span>{{ foo }} bar</span><span>baz {{ qux }}</span></div>`
      )
    ).toMatchInlineSnapshot(
      `"\`<div><span>\${interpolate(_ctx.foo)} bar</span><span>baz \${interpolate(_ctx.qux)}</span></div>\`"`
    )
  })
})
