import { normalizeClass, parseStringStyle } from '../src'

describe('normalizeClass', () => {
  test('handles undefined correctly', () => {
    expect(normalizeClass(undefined)).toEqual('')
  })

  test('handles string correctly', () => {
    expect(normalizeClass('foo')).toEqual('foo')
  })

  test('handles array correctly', () => {
    expect(normalizeClass(['foo', undefined, true, false, 'bar'])).toEqual(
      'foo bar',
    )
  })

  test('handles empty array correctly', () => {
    expect(normalizeClass([])).toEqual('')
  })

  test('handles nested array correctly', () => {
    expect(normalizeClass(['foo', ['bar'], [['baz']]])).toEqual('foo bar baz')
  })

  test('handles object correctly', () => {
    expect(normalizeClass({ foo: true, bar: false, baz: true })).toEqual(
      'foo baz',
    )
  })

  test('handles empty object correctly', () => {
    expect(normalizeClass({})).toEqual('')
  })

  test('handles arrays and objects correctly', () => {
    expect(
      normalizeClass(['foo', ['bar'], { baz: true }, [{ qux: true }]]),
    ).toEqual('foo bar baz qux')
  })

  test('handles array of objects with falsy values', () => {
    expect(
      normalizeClass([
        { foo: false },
        { bar: 0 },
        { baz: -0 },
        { qux: '' },
        { quux: null },
        { corge: undefined },
        { grault: NaN },
      ]),
    ).toEqual('')
  })

  test('handles array of objects with truthy values', () => {
    expect(
      normalizeClass([
        { foo: true },
        { bar: 'not-empty' },
        { baz: 1 },
        { qux: {} },
        { quux: [] },
      ]),
    ).toEqual('foo bar baz qux quux')
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
      );`),
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
