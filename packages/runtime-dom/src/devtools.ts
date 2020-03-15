import { setDevtoolsHook } from '@vue/runtime-core'

setDevtoolsHook(
  ((__BROWSER__ ? window : global) as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
)
