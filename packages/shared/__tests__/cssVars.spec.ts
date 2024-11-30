import { normalizeCssVarValue } from '../src'

describe('utils/cssVars', () => {
  test('should normalize css binding values correctly', () => {
    expect(normalizeCssVarValue(null)).toBe('initial')
    expect(normalizeCssVarValue(undefined)).toBe('initial')
    expect(normalizeCssVarValue('')).toBe(' ')
    expect(normalizeCssVarValue('  ')).toBe('  ')
    expect(normalizeCssVarValue('foo')).toBe('foo')
    expect(normalizeCssVarValue(0)).toBe('0')
  })

  test('should warn on invalid css binding values', () => {
    const warning =
      '[Vue warn] Invalid value used for CSS binding. Expected a string or a finite number but received:'
    expect(normalizeCssVarValue(NaN)).toBe('NaN')
    expect(warning).toHaveBeenWarnedTimes(1)
    expect(normalizeCssVarValue(Infinity)).toBe('Infinity')
    expect(warning).toHaveBeenWarnedTimes(2)
    expect(normalizeCssVarValue(-Infinity)).toBe('-Infinity')
    expect(warning).toHaveBeenWarnedTimes(3)
    expect(normalizeCssVarValue({})).toBe('[object Object]')
    expect(warning).toHaveBeenWarnedTimes(4)
    expect(normalizeCssVarValue([])).toBe('')
    expect(warning).toHaveBeenWarnedTimes(5)
  })
})
