import { isFunction, isPlainObject } from '@vue/shared'
import { ComponentInternalInstance } from '../component'
import { ComponentPublicInstance } from '../componentPublicInstance'
import { DeprecationTypes, warnDeprecation } from './compatConfig'

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

export function mergeDataOption(to: any, from: any) {
  if (!from) {
    return to
  }
  if (!to) {
    return from
  }
  return function mergedDataFn(this: ComponentPublicInstance) {
    if (isFunction(to)) {
      to = to.call(this, this)
    }
    if (isFunction(from)) {
      from = from.call(this, this)
    }
    deepMergeData(to, from, this.$)
    return to
  }
}
