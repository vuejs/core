import { extend, isArray } from '@vue/shared'
import { AppConfig } from '../apiCreateApp'
import { mergeDataOption } from './data'
import {
  DeprecationTypes,
  softAssertCompatEnabled,
  warnDeprecation
} from './compatConfig'
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
export function installLegacyConfigWarnings(config: AppConfig) {
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
          warnDeprecation(legacyConfigOptions[key], null)
        }
        val = newVal
      }
    })
  })
}

export function installLegacyOptionMergeStrats(config: AppConfig) {
  config.optionMergeStrategies = new Proxy({} as any, {
    get(target, key) {
      if (key in target) {
        return target[key]
      }
      if (
        key in legacyOptionMergeStrats &&
        softAssertCompatEnabled(
          DeprecationTypes.CONFIG_OPTION_MERGE_STRATS,
          null
        )
      ) {
        return legacyOptionMergeStrats[
          key as keyof typeof legacyOptionMergeStrats
        ]
      }
    }
  })
}

export const legacyOptionMergeStrats = {
  data: mergeDataOption,
  beforeCreate: mergeHook,
  created: mergeHook,
  beforeMount: mergeHook,
  mounted: mergeHook,
  beforeUpdate: mergeHook,
  updated: mergeHook,
  beforeDestroy: mergeHook,
  destroyed: mergeHook,
  activated: mergeHook,
  deactivated: mergeHook,
  errorCaptured: mergeHook,
  serverPrefetch: mergeHook,
  // assets
  components: mergeObjectOptions,
  directives: mergeObjectOptions,
  filters: mergeObjectOptions,
  // objects
  props: mergeObjectOptions,
  methods: mergeObjectOptions,
  inject: mergeObjectOptions,
  computed: mergeObjectOptions,
  // watch has special merge behavior in v2, but isn't actually needed in v3.
  // since we are only exposing these for compat and nobody should be relying
  // on the watch-specific behavior, just expose the object merge strat.
  watch: mergeObjectOptions
}

function mergeHook(
  to: Function[] | Function | undefined,
  from: Function | Function[]
) {
  return Array.from(new Set([...(isArray(to) ? to : to ? [to] : []), from]))
}

function mergeObjectOptions(to: Object | undefined, from: Object | undefined) {
  return to ? extend(extend(Object.create(null), to), from) : from
}
