import { extend } from '@vue/shared'
import { ComponentInternalInstance, ComponentOptions } from '../component'
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

export function getCompatConfigForKey(
  key: DeprecationTypes | 'MODE',
  instance: ComponentInternalInstance | null
) {
  const instanceConfig =
    instance && (instance.type as ComponentOptions).compatConfig
  if (instanceConfig && key in instanceConfig) {
    return instanceConfig[key]
  }
  return globalCompatConfig[key]
}

export function isCompatEnabled(
  key: DeprecationTypes,
  instance: ComponentInternalInstance | null
): boolean {
  const mode = getCompatConfigForKey('MODE', instance) || 2
  const val = getCompatConfigForKey(key, instance)
  if (mode === 2) {
    return val !== false
  } else {
    return val === true || val === 'suppress-warning'
  }
}

export function assertCompatEnabled(
  key: DeprecationTypes,
  instance: ComponentInternalInstance | null,
  ...args: any[]
) {
  if (!isCompatEnabled(key, instance)) {
    throw new Error(`${key} compat has been disabled.`)
  } else if (__DEV__) {
    warnDeprecation(key, instance, ...args)
  }
}

export function softAssertCompatEnabled(
  key: DeprecationTypes,
  instance: ComponentInternalInstance | null,
  ...args: any[]
) {
  if (__DEV__) {
    warnDeprecation(key, instance, ...args)
  }
  return isCompatEnabled(key, instance)
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
