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
  isPromise
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
})
