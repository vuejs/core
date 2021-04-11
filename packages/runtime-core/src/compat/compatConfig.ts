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
  // skip compat for built-in components
  if (instance && instance.type.__isBuiltIn) {
    return false
  }

  const mode = getCompatConfigForKey('MODE', instance) || 2
  const val = getCompatConfigForKey(key, instance)
  if (mode === 2) {
    return val !== false
  } else {
    return val === true || val === 'suppress-warning'
  }
}

/**
 * Use this for features that are completely removed in non-compat build.
 */
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

/**
 * Use this for features where legacy usage is still possible, but will likely
 * lead to runtime error if compat is disabled. (warn in all cases)
 */
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

/**
 * Use this for features with the same syntax but with mutually exclusive
 * behavior in 2 vs 3. Only warn if compat is enabled.
 * e.g. render function
 */
export function checkCompatEnabled(
  key: DeprecationTypes,
  instance: ComponentInternalInstance | null,
  ...args: any[]
) {
  const enabled = isCompatEnabled(key, instance)
  if (__DEV__ && enabled) {
    warnDeprecation(key, instance, ...args)
  }
  return enabled
}

// run tests in v3 mode by default
if (__TEST__) {
  configureCompat({
    MODE: 3
  })
}
