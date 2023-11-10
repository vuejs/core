import { escapeHtml, escapeHtmlComment } from '../src'

describe('escapeHtml', () => {
  test('ssr: escapeHTML', () => {
    expect(escapeHtml(`foo`)).toBe(`foo`)
    expect(escapeHtml(true)).toBe(`true`)
    expect(escapeHtml(false)).toBe(`false`)
    expect(escapeHtml(`a && b`)).toBe(`a &amp;&amp; b`)
    expect(escapeHtml(`"foo"`)).toBe(`&quot;foo&quot;`)
    expect(escapeHtml(`'bar'`)).toBe(`&#39;bar&#39;`)
    expect(escapeHtml(`<div>`)).toBe(`&lt;div&gt;`)
  })

  test('ssr: escapeHTMLComment', () => {
    const input = '<!-- Hello --><!-- World! -->'
    const result = escapeHtmlComment(input)
    expect(result).toEqual(' Hello  World! ')
  })

  test('ssr: escapeHTMLComment', () => {
    const input = '<!-- Comment 1 --> Hello <!--! Comment 2 --> World!'
    const result = escapeHtmlComment(input)
    expect(result).toEqual(' Comment 1  Hello ! Comment 2  World!')
  })

  test('should not affect non-comment strings', () => {
    const input = 'Hello World'
    const result = escapeHtmlComment(input)
    expect(result).toEqual(input)
  })
})
