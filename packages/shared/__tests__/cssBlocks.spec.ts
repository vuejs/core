import { normalizeStyle, parseStringStyle } from '../src'

describe('style declaration blocks', () => {
  test.each([
    '{ red; blue }',
    '[red; blue]',
    '{ outer: [one; two]; inner: { three; four } }',
    '[one; { two; three }; four]',
    'fn([one; two], { three; four })',
    String.raw`{ "};]"; \}; [one; two] }`,
  ])('preserves semicolons inside %s', value => {
    const style = `color: red; --tokens: ${value}; margin: 0`
    const expected = { color: 'red', '--tokens': value, margin: '0' }
    expect(parseStringStyle(style)).toEqual(expected)
    expect(normalizeStyle([style])).toEqual(expected)
  })

  test('keeps following declarations outside a completed block', () => {
    expect(
      parseStringStyle('--a: [one; two]; --b: {three; four}; color: red'),
    ).toEqual({ '--a': '[one; two]', '--b': '{three; four}', color: 'red' })
  })
})
