import { normalizeStyle, normalizeClass } from '../src'

describe('normalizeStyle', () => {
  test('handles string correctly', () => {
    expect(normalizeStyle('foo')).toEqual('foo')
  })

  test('handles array correctly', () => {
    expect(
      normalizeStyle(['foo: blue', { foo: 'red', bar: 5 }, 'bar: 8'])
    ).toEqual({ foo: 'red', bar: '8' })
  })

  test('handles object correctly', () => {
    expect(normalizeStyle({ foo: 'blue', bar: 5 })).toEqual({
      foo: 'blue',
      bar: 5
    })
  })

  test('ignores prototype when calculating style from input object keys', () => {
    ;(Object as any).prototype.fubar = 'fizzbuz'
    try {
      expect(
        normalizeStyle(['foo: blue', { foo: 'red', bar: 5 }, 'bar: 8'])
      ).toEqual({ foo: 'red', bar: '8' })
    } finally {
      // try/finally to avoid any chance of global test env pollution:
      delete (Object as any).prototype.fubar
    }
  })
})

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

  test('ignores prototype when calculating class list from object keys', () => {
    ;(Object as any).prototype.fubar = true
    try {
      expect(normalizeClass({ foo: true, bar: false, baz: true })).toEqual(
        'foo baz'
      )
    } finally {
      // try/finally to avoid any chance of global test env pollution:
      delete (Object as any).prototype.fubar
    }
  })
})
