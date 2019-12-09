import { makeMap } from './makeMap'

export { makeMap }
export * from './patchFlags'
export * from './globalsWhitelist'
export * from './codeframe'
export * from './domTagConfig'

export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__
  ? Object.freeze({})
  : {}
export const EMPTY_ARR: [] = []

export const NOOP = () => {}

/**
 * Always return false.
 */
export const NO = () => false

export const isOn = (key: string) => key[0] === 'o' && key[1] === 'n'

export const extend = <T extends object, U extends object>(
  a: T,
  b: U
): T & U => {
  for (const key in b) {
    ;(a as any)[key] = b[key]
  }
  return a as any
}

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

export const isArray = Array.isArray
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'
export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'

export function isPromise<T = any>(val: unknown): val is Promise<T> {
  return isObject(val) && isFunction(val.then) && isFunction(val.catch)
}

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

export function toRawType(value: unknown): string {
  return toTypeString(value).slice(8, -1)
}

export const isPlainObject = (val: unknown): val is object =>
  toTypeString(val) === '[object Object]'

export const isReservedProp = /*#__PURE__*/ makeMap(
  'key,ref,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted'
)

const camelizeRE = /-(\w)/g
export const camelize = (str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
}

const hyphenateRE = /\B([A-Z])/g
export const hyphenate = (str: string): string => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
}

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// compare whether a value has changed, accounting for NaN.
export const hasChanged = (value: any, oldValue: any): boolean =>
  value !== oldValue && (value === value || oldValue === oldValue)
