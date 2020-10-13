import { setDevtoolsHook, initCustomFormatter } from '@vue/runtime-dom'
import { getGlobalThis } from '@vue/shared'

export function initDev() {
  const target = getGlobalThis()

  target.__VUE__ = true
  setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__)

  if (__BROWSER__) {
    console.info(
      `You are running a development build of Vue.\n` +
        `Make sure to use the production build (*.prod.js) when deploying for production.`
    )

    initCustomFormatter()
  }
}
