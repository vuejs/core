import { normalizeClass } from '../src'

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
})
