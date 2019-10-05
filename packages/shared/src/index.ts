export * from './patchFlags'
export { globalsWhitelist } from './globalsWhitelist'

export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__
  ? Object.freeze({})
  : {}
export const EMPTY_ARR: [] = []

export const NOOP = () => {}

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
export const isFunction = (val: any): val is Function =>
  typeof val === 'function'
export const isString = (val: any): val is string => typeof val === 'string'
export const isSymbol = (val: any): val is symbol => typeof val === 'symbol'
export const isObject = (val: any): val is Record<any, any> =>
  val !== null && typeof val === 'object'

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

export const isPlainObject = (val: any): val is object =>
  toTypeString(val) === '[object Object]'

const vnodeHooksRE = /^vnode/
export const isReservedProp = (key: string): boolean =>
  key === 'key' || key === 'ref' || vnodeHooksRE.test(key)

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
