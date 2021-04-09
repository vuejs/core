import { isPlainObject } from '@vue/shared'
import { ComponentInternalInstance } from '../component'
import { DeprecationTypes, warnDeprecation } from './deprecations'

export function deepMergeData(
  to: any,
  from: any,
  instance: ComponentInternalInstance
) {
  for (const key in from) {
    const toVal = to[key]
    const fromVal = from[key]
    if (key in to && isPlainObject(toVal) && isPlainObject(fromVal)) {
      __DEV__ &&
        warnDeprecation(DeprecationTypes.OPTIONS_DATA_MERGE, instance, key)
      deepMergeData(toVal, fromVal, instance)
    } else {
      to[key] = fromVal
    }
  }
}
