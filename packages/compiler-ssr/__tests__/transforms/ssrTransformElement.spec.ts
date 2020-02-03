import { compile } from '../../src'

function getElementString(src: string): string {
  return compile(src).code.match(/_push\((.*)\)/)![1]
}

describe('ssr transform element', () => {
  test('basic elements', () => {
    expect(getElementString(`<div></div>`)).toMatchInlineSnapshot(
      `"\`<div></div>\`"`
    )
  })

  test('static attrs', () => {
    expect(
      getElementString(`<div id="foo" class="bar"></div>`)
    ).toMatchInlineSnapshot(`"\`<div id=\\"foo\\" class=\\"bar\\"></div>\`"`)
  })

  test('nested elements', () => {
    expect(
      getElementString(`<div><span></span><span></span></div>`)
    ).toMatchInlineSnapshot(`"\`<div><span></span><span></span></div>\`"`)
  })
})
