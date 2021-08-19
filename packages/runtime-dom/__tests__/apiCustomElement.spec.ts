import { toNumber } from '../src/apiCustomElement'

describe('Custom Element', () => {
  describe('toNumber', () => {
    it('handles strings', () => {
      expect(toNumber('')).toBe('')
      expect(toNumber(null)).toBe('')
      expect(toNumber('Something else')).toBe('Something else')
    })

    it('numbers', () => {
      expect(toNumber('0')).toBe(0)
      expect(toNumber('1')).toBe(1)
      expect(toNumber('1.1')).toBe(1.1)
      expect(toNumber('123e-1')).toBe(12.3)
      expect(toNumber('Infinity')).toBe(Infinity)
    })

    it('NaN', () => {
      expect(toNumber('NaN')).toBeNaN()
      expect(toNumber('nan')).not.toBeNaN()
    })

    // all of these are handled by Number
    it('string non decimal bases', () => {
      expect(toNumber('0b0')).toBe(0)
      expect(toNumber('0b1')).toBe(1)

      expect(toNumber('0o3')).toBe(3)
      expect(toNumber('0o0')).toBe(0)

      expect(toNumber('0x0')).toBe(0)
      expect(toNumber('0xf')).toBe(15)
    })
  })
})
