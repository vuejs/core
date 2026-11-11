import { camelize, hyphenate } from '../src'

describe('cached string functions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('cache empty string results without evicting other entries', () => {
    const replace = vi.spyOn(String.prototype, 'replace')
    expect(camelize('empty-probe')).toBe('emptyProbe')
    expect(camelize('')).toBe('')
    replace.mockClear()
    for (let i = 0; i < 100000; i++) {
      camelize('')
    }
    expect(camelize('empty-probe')).toBe('emptyProbe')
    expect(replace).not.toHaveBeenCalled()
  })

  test.each([
    [
      camelize,
      'evict-probe',
      'evictProbe',
      (i: number) => [`key-${i}`, `key${i}`],
    ],
    [
      hyphenate,
      'evictProbe',
      'evict-probe',
      (i: number) => [`key${i}A`, `key${i}-a`],
    ],
  ] as const)(
    'evict entries after many distinct inputs (%#)',
    (fn, probe, expected, entry) => {
      const replace = vi.spyOn(String.prototype, 'replace')
      expect(fn(probe)).toBe(expected)
      expect(fn(probe)).toBe(expected)
      expect(replace).toHaveBeenCalledTimes(1)

      for (let i = 0; i < 100000; i++) {
        const [input, output] = entry(i)
        expect(fn(input)).toBe(output)
      }

      replace.mockClear()
      expect(fn(probe)).toBe(expected)
      expect(replace).toHaveBeenCalledTimes(1)
    },
  )
})
