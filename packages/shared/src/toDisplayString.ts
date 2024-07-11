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
} from './general'

// can't use isRef here since @vue/shared has no deps
const isRef = (val: any): val is { value: unknown } => {
  return !!(val && val.__v_isRef === true)
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
          entries[stringifySymbol(key, i) + ' =>'] = val
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
    return String(val)
  }
  return val
}

const stringifySymbol = (v: unknown, i: number | string = ''): any =>
  // Symbol.description in es2019+ so we need to cast here to pass
  // the lib: es2016 check
  isSymbol(v) ? `Symbol(${(v as any).description ?? i})` : v
