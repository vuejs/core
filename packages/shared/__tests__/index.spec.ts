import { looseEqual, hyphenate } from '../src'
describe('EMPTY_OBJ', () => {
  beforeEach(jest.resetModules)
  it('normal empty object', () => {
    __DEV__ = false
    const { EMPTY_OBJ } = require('../src')
    expect(EMPTY_OBJ).toStrictEqual({})
  })
})

describe('hyphenate', () => {
  expect(hyphenate('iView')).toBe('i-view')
})

describe('looseEqual', () => {
  describe('same value', () => {
    it('primitive', () => {
      expect(looseEqual(1, 1)).toBe(true)
    })

    it('object', () => {
      const mockedObject = { name: 'vue' }
      expect(looseEqual(mockedObject, mockedObject)).toBe(true)
    })
  })

  describe('all are object', () => {
    describe('array', () => {
      const mockedArray1 = [NaN, undefined]
      const mockedArray2 = [1, 2, 3]
      const mockedArray3 = [1, 2, 3]
      const mockedArray4 = [2, 3, 4]
      it('return false | different length', () => {
        expect(looseEqual(mockedArray1, mockedArray2)).toBe(false)
      })

      it('return ture | same length and equal element', () => {
        expect(looseEqual(mockedArray2, mockedArray3)).toBe(true)
      })

      it('return false | same lenght but different element', () => {
        expect(looseEqual(mockedArray3, mockedArray4)).toBe(false)
      })
    })

    describe('date', () => {
      const mockedDate1 = new Date(2019, 10, 13)
      const mockedDate2 = new Date(2019, 10, 14)
      const mockedDate3 = new Date(2019, 10, 13)
      it('return true | same time', () => {
        expect(looseEqual(mockedDate1, mockedDate3)).toBe(true)
      })

      it('return fasle | different time', () => {
        expect(looseEqual(mockedDate1, mockedDate2)).toBe(false)
      })
    })

    describe('non-array and non-date', () => {
      const mockedObj1 = { name: 'vue' }
      const mockedObj2 = { name: 'iview', star: '10000' }
      const mockedObj3 = { name: 'vue', star: '20000' }
      const mockedObj4 = { name: 'vue' }
      it('return false | different length', () => {
        expect(looseEqual(mockedObj1, mockedObj2)).toBe(false)
      })

      it('return false | same length but different elements', () => {
        expect(looseEqual(mockedObj2, mockedObj3)).toBe(false)
      })

      it('return ture | same length and equal elements', () => {
        expect(looseEqual(mockedObj1, mockedObj4)).toBe(true)
      })
    })

    describe('different kind of object', () => {
      it('return false | one Function, one Array', () => {
        expect(looseEqual(() => {}, [])).toBe(false)
      })

      it('return false | one Array, one Date', () => {
        expect(looseEqual([], new Date())).toBe(false)
      })
    })
  })

  describe('all are primitive value', () => {
    it('return false | boolean and number', () => {
      expect(looseEqual(true, 1)).toBe(false)
    })
    it('return false | string and number', () => {
      expect(looseEqual('vue', 20000)).toBe(false)
    })
  })

  describe('one object and one primitive value', () => {
    it('return false | number and object', () => {
      expect(looseEqual(NaN, null)).toBe(false)
    })
  })
})
