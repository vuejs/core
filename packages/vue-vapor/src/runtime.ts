// This entry exports the runtime only, and is built as
// `dist/vue.esm-bundler.js` which is used by default for bundlers.
import { initDev } from './dev'
// TODO implement warn
// import { warn } from '@vue/runtime-vapor'

if (__DEV__) {
  initDev()
}

export * from '@vue/runtime-vapor'

export const compile = (): void => {
  if (__DEV__) {
    console.warn(
      `Runtime compilation is not supported in this build of Vue.` +
        (__ESM_BUNDLER__
          ? ` Configure your bundler to alias "vue" to "vue/dist/vue-vapor.esm-bundler.js".`
          : __ESM_BROWSER__
            ? ` Use "vue-vapor.esm-browser.js" instead.`
            : __GLOBAL__
              ? ` Use "vue-vapor.global.js" instead.`
              : ``) /* should not happen */,
    )
  }
}
