import { isArray, isString } from '@vue/shared'
import { AppConfig } from '../apiCreateApp'
import { isRuntimeOnly } from '../component'
import { DeprecationTypes, warnDeprecation } from './deprecations'
import { isCopyingConfig } from './global'

// legacy config warnings
export type LegacyConfig = {
  /**
   * @deprecated `config.silent` option has been removed
   */
  silent?: boolean
  /**
   * @deprecated use __VUE_PROD_DEVTOOLS__ compile-time feature flag instead
   * https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
   */
  devtools?: boolean
  /**
   * @deprecated use `config.isCustomElement` instead
   * https://v3.vuejs.org/guide/migration/global-api.html#config-ignoredelements-is-now-config-iscustomelement
   */
  ignoredElements?: (string | RegExp)[]
  /**
   * @deprecated
   * https://v3.vuejs.org/guide/migration/keycode-modifiers.html
   */
  keyCodes?: Record<string, number | number[]>
  /**
   * @deprecated
   * https://v3.vuejs.org/guide/migration/global-api.html#config-productiontip-removed
   */
  productionTip?: boolean
}

// dev only
export function installLegacyConfigTraps(config: AppConfig) {
  const legacyConfigOptions: Record<string, DeprecationTypes> = {
    silent: DeprecationTypes.CONFIG_SILENT,
    devtools: DeprecationTypes.CONFIG_DEVTOOLS,
    ignoredElements: DeprecationTypes.CONFIG_IGNORED_ELEMENTS,
    keyCodes: DeprecationTypes.CONFIG_KEY_CODES,
    productionTip: DeprecationTypes.CONFIG_PRODUCTION_TIP
  }

  Object.keys(legacyConfigOptions).forEach(key => {
    let val = (config as any)[key]
    Object.defineProperty(config, key, {
      enumerable: true,
      get() {
        return val
      },
      set(newVal) {
        if (!isCopyingConfig) {
          warnDeprecation(legacyConfigOptions[key])
        }
        val = newVal

        // compat for runtime ignoredElements -> isCustomElement
        if (key === 'ignoredElements' && !isRuntimeOnly() && isArray(newVal)) {
          config.isCustomElement = tag => {
            return newVal.some(
              val => (isString(val) ? val === tag : val.test(tag))
            )
          }
        }
      }
    })
  })
}
