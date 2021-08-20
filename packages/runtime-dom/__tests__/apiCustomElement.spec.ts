import { parseNumber } from '../src/apiCustomElement'

describe('Custom Element', () => {
  describe('parseNumber', () => {
    it('handles strings', () => {
      expect(parseNumber('')).toBe('')
      expect(parseNumber(null)).toBe('')
      expect(parseNumber('Something else')).toBe('Something else')
    })

    it('numbers', () => {
      expect(parseNumber('0')).toBe(0)
      expect(parseNumber('1')).toBe(1)
      expect(parseNumber('1.1')).toBe(1.1)
      expect(parseNumber('123e-1')).toBe(12.3)
      expect(parseNumber('Infinity')).toBe(Infinity)
    })

    it('NaN', () => {
      expect(parseNumber('NaN')).toBeNaN()
      expect(parseNumber('nan')).not.toBeNaN()
    })

    // all of these are handled by Number
    it('string non decimal bases', () => {
      expect(parseNumber('0b0')).toBe(0)
      expect(parseNumber('0b1')).toBe(1)

      expect(parseNumber('0o3')).toBe(3)
      expect(parseNumber('0o0')).toBe(0)

      expect(parseNumber('0x0')).toBe(0)
      expect(parseNumber('0xf')).toBe(15)
    })
  })
})
