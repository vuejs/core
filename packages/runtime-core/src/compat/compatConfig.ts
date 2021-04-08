import { extend } from '@vue/shared'
import { ComponentOptions, getCurrentInstance } from '../component'
import { DeprecationTypes, warnDeprecation } from './deprecations'

export type CompatConfig = Partial<
  Record<DeprecationTypes, boolean | 'suppress-warning'>
> & {
  MODE?: 2 | 3
}

const globalCompatConfig: CompatConfig = {}

export function configureCompat(config: CompatConfig) {
  extend(globalCompatConfig, config)
}

export function getCompatConfigForKey(key: DeprecationTypes | 'MODE') {
  const instance = getCurrentInstance()
  const instanceConfig =
    instance && (instance.type as ComponentOptions).compatConfig
  if (instanceConfig && key in instanceConfig) {
    return instanceConfig[key]
  }
  return globalCompatConfig[key]
}

export function isCompatEnabled(key: DeprecationTypes): boolean {
  const mode = getCompatConfigForKey('MODE') || 2
  const val = getCompatConfigForKey(key)
  if (mode === 2) {
    return val !== false
  } else {
    return val === true || val === 'suppress-warning'
  }
}

export function assertCompatEnabled(key: DeprecationTypes, ...args: any[]) {
  if (!isCompatEnabled(key)) {
    throw new Error(`${key} compat has been disabled.`)
  } else if (__DEV__) {
    warnDeprecation(key, ...args)
  }
}

export function softAssertCompatEnabled(key: DeprecationTypes, ...args: any[]) {
  if (__DEV__) {
    warnDeprecation(key, ...args)
  }
  return isCompatEnabled(key)
}

// disable features that conflict with v3 behavior
if (__TEST__) {
  configureCompat({
    COMPONENT_ASYNC: false,
    COMPONENT_FUNCTIONAL: false,
    WATCH_ARRAY: false,
    INSTANCE_ATTRS_CLASS_STYLE: false
  })
}
