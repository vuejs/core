import { isPlainObject } from '@vue/shared'
import { DeprecationTypes, warnDeprecation } from './deprecations'

export function deepMergeData(to: any, from: any) {
  for (const key in from) {
    const toVal = to[key]
    const fromVal = from[key]
    if (key in to && isPlainObject(toVal) && isPlainObject(fromVal)) {
      __DEV__ && warnDeprecation(DeprecationTypes.OPTIONS_DATA_MERGE, key)
      deepMergeData(toVal, fromVal)
    } else {
      to[key] = fromVal
    }
  }
}
