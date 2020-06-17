import { version, setDevtoolsHook } from '@vue/runtime-dom'

export function initDev() {
  const target: any = __BROWSER__ ? window : global

  target.__VUE__ = version
  setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__)

  if (__BROWSER__) {
    // @ts-ignore `console.info` cannot be null error
    console[console.info ? 'info' : 'log'](
      `You are running a development build of Vue.\n` +
        `Make sure to use the production build (*.prod.js) when deploying for production.`
    )
  }
}
