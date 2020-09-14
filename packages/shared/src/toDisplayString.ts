import { isArray, isObject, isPlainObject } from './index'

/**
 * For converting {{ interpolation }} values to displayed strings.
 * @private
 */
export const toDisplayString = (val: unknown): string => {
  return val == null
    ? ''
    : isObject(val)
      ? JSON.stringify(val, replacer, 2)
      : String(val)
}

const replacer = (_key: string, val: any) => {
  if (val instanceof Map) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce((entries, [key, val]) => {
        ;(entries as any)[`${key} =>`] = val
        return entries
      }, {})
    }
  } else if (val instanceof Set) {
    return {
      [`Set(${val.size})`]: [...val.values()]
    }
  } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    return String(val)
  }
  return val
}
