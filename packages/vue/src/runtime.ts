// This entry exports the runtime only, and is built as
// `dist/vue.esm-bundler.js` which is used by default for bundlers.
import { NOOP } from '@vue/shared'
import { initDev } from './dev'
import { type RenderFunction, warn } from '@vue/runtime-dom'

if (__DEV__) {
  initDev()
}

export * from '@vue/runtime-dom'
// SSR uses the standard runtime entry, so expose the Vapor async name as the
// VDOM async wrapper for hand-written imports outside SFC compileScript.
export { defineAsyncComponent as defineVaporAsyncComponent } from '@vue/runtime-dom'

export const compile = (_template: string): RenderFunction => {
  if (__DEV__) {
    warn(
      `Runtime compilation is not supported in this build of Vue.` +
        (__ESM_BUNDLER__
          ? ` Configure your bundler to alias "vue" to "vue/dist/vue.esm-bundler.js".`
          : __ESM_BROWSER__
            ? ` Use "vue.esm-browser.js" instead.`
            : __GLOBAL__
              ? ` Use "vue.global.js" instead.`
              : ``) /* should not happen */,
    )
  }
  return NOOP
}
