import {
  isFunction,
  isObject,
  isArray,
  isRegExp,
  isDate,
  isMap,
  isSet,
  isSymbol,
  isString,
  isPromise,
  hasOwn,
  isOn,
  isPlainObject,
  isIntegerKey,
  looseToNumber,
  remove
} from '../src'
describe('utils/general', () => {
  test('isFunction', () => {
    expect(isFunction(() => {})).toBe(true)
    expect(isFunction(Object)).toBe(true)
    expect(isFunction(function () {})).toBe(true)
    expect(isFunction(new Function())).toBe(true)
    expect(isFunction(null)).toBe(false)
    expect(isFunction(undefined)).toBe(false)
    expect(isFunction(1)).toBe(false)
    expect(isFunction('')).toBe(false)
    expect(isFunction({})).toBe(false)
    expect(isFunction([])).toBe(false)
  })

  test('isObject', () => {
    expect(isObject({})).toBe(true)
    expect(isObject([])).toBe(true)
    expect(isObject(new Date())).toBe(true)
    expect(isObject(new RegExp(''))).toBe(true)
    expect(isObject(new Function())).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject(undefined)).toBe(false)
    expect(isObject(1)).toBe(false)
    expect(isObject('')).toBe(false)
  })

  test('isArray', () => {
    expect(isArray([])).toBe(true)
    expect(isArray(new Array())).toBe(true)
    expect(isArray(null)).toBe(false)
    expect(isArray(undefined)).toBe(false)
    expect(isArray(1)).toBe(false)
    expect(isArray('')).toBe(false)
    expect(isArray({})).toBe(false)
  })

  test('isRegExp', () => {
    expect(isRegExp(/a/)).toBe(true)
    expect(isRegExp(new RegExp('a'))).toBe(true)
    expect(isRegExp(null)).toBe(false)
    expect(isRegExp(undefined)).toBe(false)
    expect(isRegExp(1)).toBe(false)
    expect(isRegExp('')).toBe(false)
    expect(isRegExp({})).toBe(false)
    expect(isRegExp([])).toBe(false)
  })

  test('isDate', () => {
    expect(isDate(new Date())).toBe(true)
    expect(isDate(null)).toBe(false)
    expect(isDate(undefined)).toBe(false)
    expect(isDate(1)).toBe(false)
    expect(isDate('')).toBe(false)
    expect(isDate({})).toBe(false)
    expect(isDate([])).toBe(false)
  })

  test('isMap', () => {
    expect(isMap(new Map())).toBe(true)
    expect(isMap(null)).toBe(false)
    expect(isMap(undefined)).toBe(false)
    expect(isMap(1)).toBe(false)
    expect(isMap('')).toBe(false)
    expect(isMap({})).toBe(false)
    expect(isMap([])).toBe(false)
  })

  test('isSet', () => {
    expect(isSet(new Set())).toBe(true)
    expect(isSet(null)).toBe(false)
    expect(isSet(undefined)).toBe(false)
    expect(isSet(1)).toBe(false)
    expect(isSet('')).toBe(false)
    expect(isSet({})).toBe(false)
    expect(isSet([])).toBe(false)
  })

  test('isSymbol', () => {
    expect(isSymbol(Symbol())).toBe(true)
    expect(isSymbol(null)).toBe(false)
    expect(isSymbol(undefined)).toBe(false)
    expect(isSymbol(1)).toBe(false)
    expect(isSymbol('')).toBe(false)
    expect(isSymbol({})).toBe(false)
    expect(isSymbol([])).toBe(false)
  })

  test('isString', () => {
    expect(isString('')).toBe(true)
    expect(isString(new String())).toBe(false)
    expect(isString(null)).toBe(false)
    expect(isString(undefined)).toBe(false)
    expect(isString(1)).toBe(false)
    expect(isString({})).toBe(false)
    expect(isString([])).toBe(false)
  })

  test('isPromise', () => {
    const p = new Promise(resolve => {
      resolve(1)
    })
    expect(isPromise(p)).toBe(true)
    expect(isPromise(Promise.resolve())).toBe(true)
    expect(isPromise(null)).toBe(false)
    expect(isPromise(undefined)).toBe(false)
    expect(isPromise(1)).toBe(false)
    expect(isPromise('')).toBe(false)
    expect(isPromise({})).toBe(false)
    expect(isPromise([])).toBe(false)
  })

  test('hasOwn', () => {
    const obj = {
      a: 1
    }
    expect(hasOwn(obj, 'a')).toBe(true)
    expect(hasOwn(obj, 'b')).toBe(false)
  })

  test('isPlainObject', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
    expect(isPlainObject(new Object())).toBe(true)
    expect(isPlainObject(Object.create({}))).toBe(true)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
    expect(isPlainObject(1)).toBe(false)
    expect(isPlainObject('')).toBe(false)
    expect(isPlainObject([])).toBe(false)
  })

  test('isIntegerKey', () => {
    expect(isIntegerKey('0')).toBe(true)
    expect(isIntegerKey('1')).toBe(true)
    expect(isIntegerKey('42')).toBe(true)
    expect(isIntegerKey('100')).toBe(true)
    expect(isIntegerKey('123456789')).toBe(true)
    expect(isIntegerKey('')).toBe(false)
    expect(isIntegerKey('NaN')).toBe(false)
    expect(isIntegerKey('-1')).toBe(false)
    expect(isIntegerKey('-42')).toBe(false)
    expect(isIntegerKey('3.14')).toBe(false)
    expect(isIntegerKey('1.23e-4')).toBe(false)
    expect(isIntegerKey('123a')).toBe(false)
    expect(isIntegerKey('abc')).toBe(false)
    expect(isIntegerKey(null)).toBe(false)
    expect(isIntegerKey(undefined)).toBe(false)
    expect(isIntegerKey({ key: 'value' })).toBe(false)
    expect(isIntegerKey([1, 2, 3])).toBe(false)
    expect(isIntegerKey(true)).toBe(false)
    expect(isIntegerKey(false)).toBe(false)
  })

  test('looseToNumber', () => {
    expect(looseToNumber('0')).toBe(0)
    expect(looseToNumber('1')).toBe(1)
    expect(looseToNumber('42')).toBe(42)
    expect(looseToNumber('100')).toBe(100)
    expect(looseToNumber('123456789')).toBe(123456789)
    expect(looseToNumber('-1')).toBe(-1)
    expect(looseToNumber('-42')).toBe(-42)
    expect(looseToNumber('3.14')).toBe(3.14)
    expect(looseToNumber('1.23e-4')).toBe(1.23e-4)
    expect(looseToNumber('123a')).toBe(123)
    expect(looseToNumber('abc')).toBe('abc')
    expect(looseToNumber(null)).toBe(null)
    expect(looseToNumber(undefined)).toBe(undefined)
    expect(looseToNumber({ key: 'value' })).toEqual({ key: 'value' })
    expect(looseToNumber([1, 2, 3])).toEqual(1)
    expect(looseToNumber(true)).toBe(true)
    expect(looseToNumber(false)).toBe(false)
  })

  test('isOn', () => {
    expect(isOn('onClick')).toBe(true)
    expect(isOn('onclick')).toBe(false)
    expect(isOn('on')).toBe(false)
    expect(isOn('click')).toBe(false)
  })

  test('remove', () => {
    const arr = [1, 2, 3]
    remove(arr, 2)
    expect(arr).toEqual([1, 3])

    const arr2 = [1, 2, 3]
    remove(arr2, 0)
    expect(arr2).toEqual([1, 2, 3])
  })
})
