import { extend } from '@vue/shared'
import { DeprecationTypes, warnDeprecation } from './deprecations'

export type CompatConfig = Partial<
  Record<DeprecationTypes, DeprecationConfigItem>
>

export interface DeprecationConfigItem {
  warning?: boolean // default: true
  enabled?: boolean // default: true
}

const globalCompatConfig: CompatConfig = {}

export function configureCompat(config: CompatConfig) {
  extend(globalCompatConfig, config)
}

export function getCompatConfig(
  key: DeprecationTypes
): DeprecationConfigItem | undefined {
  return globalCompatConfig[key]
}

export function isCompatEnabled(key: DeprecationTypes): boolean {
  const config = getCompatConfig(key)
  return !config || config.enabled !== false
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
