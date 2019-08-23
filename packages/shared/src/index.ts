export const EMPTY_OBJ: { readonly [key: string]: any } = Object.freeze({})
export const EMPTY_ARR: [] = []

export const NOOP = () => {}

export const reservedPropRE = /^(?:key|ref|slots)$|^vnode/

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

export const isArray = Array.isArray
export const isFunction = (val: any): val is Function =>
  typeof val === 'function'
export const isString = (val: any): val is string => typeof val === 'string'
export const isObject = (val: any): val is Record<any, any> =>
  val !== null && typeof val === 'object'

export const isReservedProp = (key: string): boolean =>
  key === 'key' || key === 'ref'

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

export function invokeHandlers(
  handlers: Function | Function[],
  args: any[] = EMPTY_ARR
) {
  if (isArray(handlers)) {
    for (let i = 0; i < handlers.length; i++) {
      handlers[i].apply(null, args)
    }
  } else {
    handlers.apply(null, args)
  }
}
