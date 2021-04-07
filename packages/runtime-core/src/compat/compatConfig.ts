import { extend } from '@vue/shared'
import { DeprecationTypes } from './deprecations'

export type CompatConfig = Partial<
  Record<DeprecationTypes, DeprecationConfigItem>
>

export interface DeprecationConfigItem {
  warning?: boolean // defaults to true
  mode?: 2 | 3 // defaults to 2
}

const globalCompatConfig: CompatConfig = {}

export function configureCompat(config: CompatConfig) {
  extend(globalCompatConfig, config)
}

/**
 * @internal
 */
export function getCompatConfig(
  key: DeprecationTypes
): DeprecationConfigItem | undefined {
  return globalCompatConfig[key]
}
