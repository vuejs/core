import { normalizeClass, parseStringStyle } from '../src'

describe('normalizeClass', () => {
  test('handles string correctly', () => {
    expect(normalizeClass('foo')).toEqual('foo')
  })

  test('handles array correctly', () => {
    expect(normalizeClass(['foo', undefined, true, false, 'bar'])).toEqual(
      'foo bar'
    )
  })

  test('handles object correctly', () => {
    expect(normalizeClass({ foo: true, bar: false, baz: true })).toEqual(
      'foo baz'
    )
  })

  // #6777
  test('parse multi-line inline style', () => {
    expect(
      parseStringStyle(`border: 1px solid transparent;
    background: linear-gradient(white, white) padding-box,
      repeating-linear-gradient(
        -45deg,
        #ccc 0,
        #ccc 0.5em,
        white 0,
        white 0.75em
      );`)
    ).toMatchInlineSnapshot(`
      {
        "background": "linear-gradient(white, white) padding-box,
            repeating-linear-gradient(
              -45deg,
              #ccc 0,
              #ccc 0.5em,
              white 0,
              white 0.75em
            )",
        "border": "1px solid transparent",
      }
    `)
  })
})
