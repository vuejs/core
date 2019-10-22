import { isArray, isPlainObject, objectToString } from '@vue/shared'

// for converting {{ interpolation }} values to displayed strings.
export function toString(val: unknown): string {
  return val == null
    ? ''
    : isArray(val) || (isPlainObject(val) && val.toString === objectToString)
      ? JSON.stringify(val, null, 2)
      : String(val)
}
