// This entry exports the runtime only, and is built as
// `dist/vue.esm-bundler.js` which is used by default for bundlers.
import { initDev } from './dev'
import {
  compatUtils,
  createApp,
  Transition,
  TransitionGroup,
  KeepAlive,
  DeprecationTypes,
  vShow,
  vModelDynamic
} from '@vue/runtime-dom'
import { extend } from '@vue/shared'

if (__DEV__) {
  initDev()
}

import * as runtimeDom from '@vue/runtime-dom'

function wrappedCreateApp(...args: any[]) {
  // @ts-ignore
  const app = createApp(...args)
  if (compatUtils.isCompatEnabled(DeprecationTypes.RENDER_FUNCTION, null)) {
    // register built-in components so that they can be resolved via strings
    // in the legacy h() call. The __compat__ prefix is to ensure that v3 h()
    // doesn't get affected.
    app.component('__compat__transition', Transition)
    app.component('__compat__transition-group', TransitionGroup)
    app.component('__compat__keep-alive', KeepAlive)
    // built-in directives. No need for prefix since there's no render fn API
    // for resolving directives via string in v3.
    app._context.directives.show = vShow
    app._context.directives.model = vModelDynamic
  }
  return app
}

export function createCompatVue() {
  const Vue = compatUtils.createCompatVue(wrappedCreateApp)
  extend(Vue, runtimeDom)
  // @ts-ignore
  Vue.createApp = wrappedCreateApp
  return Vue
}
