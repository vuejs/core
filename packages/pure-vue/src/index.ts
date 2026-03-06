// This entry is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { initDev } from './dev'

if (__DEV__) {
  initDev()
}
export * from '@vue/pure-runtime-dom'
