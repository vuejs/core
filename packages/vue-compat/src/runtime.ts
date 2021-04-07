// This entry exports the runtime only, and is built as
// `dist/vue.esm-bundler.js` which is used by default for bundlers.
import { initDev } from './dev'
import { compatUtils, createApp, warn } from '@vue/runtime-dom'
import { extend } from '@vue/shared'

if (__DEV__) {
  initDev()
}

import * as runtimeDom from '@vue/runtime-dom'

const Vue = compatUtils.createCompatVue(createApp)

Vue.compile = (() => {
  if (__DEV__) {
    warn(
      `Runtime compilation is not supported in this build of Vue.` +
        (__ESM_BUNDLER__
          ? ` Configure your bundler to alias "vue" to "@vue/compat/dist/vue.esm-bundler.js".`
          : __ESM_BROWSER__
            ? ` Use "vue.esm-browser.js" instead.`
            : __GLOBAL__
              ? ` Use "vue.global.js" instead.`
              : ``) /* should not happen */
    )
  }
}) as any

extend(Vue, runtimeDom)

export default Vue
