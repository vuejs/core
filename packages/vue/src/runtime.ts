// This entry exports the runtime only, and is built as
// `dist/vue.esm-bundler.js` which is used by default for bundlers.
import { initDev } from './dev'

if (__DEV__) {
  initDev()
}

export * from '@vue/runtime-dom'
