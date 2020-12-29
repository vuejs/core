import { toHandlerKey, isObject } from '@vue/shared'
import { warn } from '../warning'

/**
 * For prefixing keys in v-on="obj" with "on"
 * @private
 */
export function toHandlers(obj: Record<string, any>): Record<string, any> {
  const ret: Record<string, any> = {}
  if (__DEV__ && !isObject(obj)) {
    warn(`v-on with no argument expects an object value.`)
    return ret
  }
  for (const key in obj) {
    ret[toHandlerKey(key)] = obj[key]
  }
  return ret
}
