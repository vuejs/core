import { getGlobalThis } from '@vue/shared'

/**
 * This is only called in esm-bundler builds.
 * It is called when a renderer is created, in `baseCreateRenderer` so that
 * importing runtime-core is side-effects free.
 *
 * istanbul-ignore-next
 */
export function initFeatureFlags() {
  let needWarn = false

  if (typeof __FEATURE_OPTIONS_API__ !== 'boolean') {
    needWarn = true
    getGlobalThis().__VUE_OPTIONS_API__ = true
  }

  if (typeof __FEATURE_PROD_DEVTOOLS__ !== 'boolean') {
    needWarn = true
    getGlobalThis().__VUE_PROD_DEVTOOLS__ = false
  }

  if (__DEV__ && needWarn) {
    console.warn(
      `You are running the esm-bundler build of Vue. It is recommended to ` +
        `configure your bundler to explicitly replace the following global ` +
        `variables with boolean literals so that it can remove unnecessary code:\n\n` +
        `- __VUE_OPTIONS_API__ (support for Options API, default: true)\n` +
        `- __VUE_PROD_DEVTOOLS__ (enable devtools inspection in production, default: false)`
      // TODO link to docs
    )
  }
}
