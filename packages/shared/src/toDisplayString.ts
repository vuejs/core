// enums are compiled away via custom transform so no real dependency here
import { ReactiveFlags } from '@vue/reactivity'
import {
  isArray,
  isFunction,
  isMap,
  isObject,
  isPlainObject,
  isSet,
  isString,
  isSymbol,
  objectToString,
  toTypeString,
} from './general'

// can't use isRef here since @vue/shared has no deps
const isRef = (val: any): val is { value: unknown } => {
  return !!(val && val[ReactiveFlags.IS_REF] === true)
}

/**
 * For converting {{ interpolation }} values to displayed strings.
 * @private
 */
export const toDisplayString = (val: unknown): string => {
  return isString(val)
    ? val
    : val == null
      ? ''
      : isArray(val) ||
          (isObject(val) &&
            (val.toString === objectToString || !isFunction(val.toString)))
        ? isRef(val)
          ? toDisplayString(val.value)
          : JSON.stringify(val, replacer, 2)
        : String(val)
}

const replacer = (_key: string, val: unknown): any => {
  if (isRef(val)) {
    return replacer(_key, val.value)
  } else if (isMap(val)) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce(
        (entries, [key, val], i) => {
          entries[
            (lacksStringConversion(key)
              ? toTypeString(key)
              : stringifySymbol(key, i)) + ' =>'
          ] = val
          return entries
        },
        {} as Record<string, any>,
      ),
    }
  } else if (isSet(val)) {
    return {
      [`Set(${val.size})`]: [...val.values()].map(v => stringifySymbol(v)),
    }
  } else if (isSymbol(val)) {
    return stringifySymbol(val)
  } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    // native elements
    return lacksStringConversion(val) ? toTypeString(val) : String(val)
  }
  return val
}

const stringifySymbol = (v: unknown, i: number | string = ''): any =>
  // Symbol.description in es2019+ so we need to cast here to pass
  // the lib: es2016 check
  isSymbol(v) ? `Symbol(${(v as any).description ?? i})` : v

/**
 * Objects may expose none of the string conversion methods
 * (`Symbol.toPrimitive`, `toString`, `valueOf`) — e.g. `Object.create(null)`
 * or built-ins with their prototype stripped — and throw when coerced to a
 * string. The methods are probed via plain property access, the same
 * lookups string coercion itself performs, so objects that coerce fine
 * (e.g. proxies with a throwing `getPrototypeOf` trap but a working
 * `Symbol.toPrimitive`) are not failed prematurely. Fall back to the type
 * string, e.g. "[object Date]", when none of them is callable.
 */
const lacksStringConversion = (val: unknown): boolean =>
  isObject(val) &&
  (val as any)[Symbol.toPrimitive] == null &&
  !isFunction(val.toString) &&
  !isFunction(val.valueOf)
