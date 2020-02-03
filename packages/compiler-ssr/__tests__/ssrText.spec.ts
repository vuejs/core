import { getCompiledString } from './utils'

describe('ssr: text', () => {
  test('static text', () => {
    expect(getCompiledString(`foo`)).toMatchInlineSnapshot(`"\`foo\`"`)
  })

  test('static text escape', () => {
    expect(getCompiledString(`&lt;foo&gt;`)).toMatchInlineSnapshot(
      `"\`&lt;foo&gt;\`"`
    )
  })

  test('nested elements with static text', () => {
    expect(
      getCompiledString(`<div><span>hello</span><span>bye</span></div>`)
    ).toMatchInlineSnapshot(
      `"\`<div><span>hello</span><span>bye</span></div>\`"`
    )
  })

  test('interpolation', () => {
    expect(getCompiledString(`foo {{ bar }} baz`)).toMatchInlineSnapshot(
      `"\`foo \${interpolate(_ctx.bar)} baz\`"`
    )
  })

  test('nested elements with interpolation', () => {
    expect(
      getCompiledString(
        `<div><span>{{ foo }} bar</span><span>baz {{ qux }}</span></div>`
      )
    ).toMatchInlineSnapshot(
      `"\`<div><span>\${interpolate(_ctx.foo)} bar</span><span>baz \${interpolate(_ctx.qux)}</span></div>\`"`
    )
  })
})
