import { decodeHtmlBrowser } from '../src/decodeHtmlBrowser'

describe('decodeHtmlBrowser', () => {
  it('should decode HTML correctly', () => {
    expect(decodeHtmlBrowser(' abc  123 ')).toBe(' abc  123 ')

    expect(decodeHtmlBrowser('&')).toBe('&')
    expect(decodeHtmlBrowser('&amp;')).toBe('&')
    expect(decodeHtmlBrowser('&amp;amp;')).toBe('&amp;')

    expect(decodeHtmlBrowser('<')).toBe('<')
    expect(decodeHtmlBrowser('&lt;')).toBe('<')
    expect(decodeHtmlBrowser('&amp;lt;')).toBe('&lt;')

    expect(decodeHtmlBrowser('>')).toBe('>')
    expect(decodeHtmlBrowser('&gt;')).toBe('>')
    expect(decodeHtmlBrowser('&amp;gt;')).toBe('&gt;')

    expect(decodeHtmlBrowser('&nbsp;')).toBe('\u00a0')
    expect(decodeHtmlBrowser('&quot;')).toBe('"')
    expect(decodeHtmlBrowser('&apos;')).toBe("'")

    expect(decodeHtmlBrowser('&Eacute;')).toBe('\u00c9')
    expect(decodeHtmlBrowser('&#xc9;')).toBe('\u00c9')
    expect(decodeHtmlBrowser('&#201;')).toBe('\u00c9')

    // #3001
    expect(decodeHtmlBrowser('<strong>Text</strong>')).toBe(
      '<strong>Text</strong>'
    )
    expect(decodeHtmlBrowser('<strong>&amp;</strong>')).toBe(
      '<strong>&</strong>'
    )
    expect(
      decodeHtmlBrowser('<strong>&lt;strong&gt;&amp;&lt;/strong&gt;</strong>')
    ).toBe('<strong><strong>&</strong></strong>')
  })
})
