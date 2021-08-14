import {
  isArray,
  isMap,
  isObject,
  isPlainObject,
  isSet,
  isFunction,
  objectToString
} from './index'

/**
 * For converting {{ interpolation }} values to displayed strings.
 * @private
 */
export const toDisplayString = (val: unknown): string => {
  if (val == null) return ''

  let hasToString = false
  if (!isObject(val)) {
    hasToString = true
  } else if (isArray(val)) {
    // skip toString override check for Array
    hasToString = false
  } else {
    // Object - check if toString is an invokable override
    hasToString =
      val.toString &&
      val.toString !== objectToString &&
      isFunction(val.toString)
  }
  return hasToString ? String(val) : JSON.stringify(val, replacer, 2)
}

const replacer = (_key: string, val: any): any => {
  // can't use isRef here since @vue/shared has no deps
  if (val && val.__v_isRef) {
    return replacer(_key, val.value)
  } else if (isMap(val)) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce((entries, [key, val]) => {
        ;(entries as any)[`${key} =>`] = val
        return entries
      }, {})
    }
  } else if (isSet(val)) {
    return {
      [`Set(${val.size})`]: [...val.values()]
    }
  } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    return String(val)
  }
  return val
}
