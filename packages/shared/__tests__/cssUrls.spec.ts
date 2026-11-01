import { normalizeStyle, parseStringStyle } from '../src'

describe('style URL tokens', () => {
  test.each([
    'url(https://example.com/[)',
    'URL(https://example.com/{)',
    'url(https://example.com/[;x)',
    String.raw`url(https://example.com/a\)b[)`,
    String.raw`\75rl(https://example.com/[)`,
    String.raw`u\72l(https://example.com/[)`,
    String.raw`\url(https://example.com/[)`,
    String.raw`\000075 rl(https://example.com/[)`,
    'url( \t\nhttps://example.com/[)',
    'fn(url(https://example.com/[); [one; two])',
    '<!--url(https://example.com/[)',
  ])('preserves unquoted URL tokens and following declarations: %s', value => {
    const style = `--tokens: ${value}; color: red`
    const expected = { '--tokens': value, color: 'red' }
    expect(parseStringStyle(style)).toEqual(expected)
    expect(normalizeStyle([style])).toEqual(expected)
  })

  test.each([
    'myurl',
    '-url',
    '--url',
    '_url',
    'éurl',
    String.raw`\6d yurl`,
    '#url',
    '@url',
    String.raw`#\75rl`,
  ])('does not consume an ordinary function as a URL: %s', name => {
    const value = `${name}(fn(a); [one; two])`
    expect(parseStringStyle(`--tokens: ${value}; color: red`)).toEqual({
      '--tokens': value,
      color: 'red',
    })
  })

  test.each(['url("https://example.com/[")', "URL( 'https://example.com/{' )"])(
    'keeps quoted URLs on the normal string/block path: %s',
    value => {
      expect(parseStringStyle(`--tokens: ${value}; color: red`)).toEqual({
        '--tokens': value,
        color: 'red',
      })
    },
  )
})
