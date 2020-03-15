import { setDevtoolsHook } from '@vue/runtime-core'

const target: any = __BROWSER__ ? window : global

target.__VUE__ = true
setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__)
