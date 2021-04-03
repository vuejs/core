import { reactive } from '@vue/reactivity'
import {
  createApp,
  defineComponent,
  nextTick,
  App,
  AppConfig,
  Plugin,
  Component,
  ComponentOptions,
  ComponentPublicInstance,
  Directive,
  RenderFunction,
  isRuntimeOnly
} from '@vue/runtime-dom'

// TODO make these getter/setters and trigger deprecation warnings
export type LegacyConfig = AppConfig & {
  /**
   * @deprecated `config.silent` option has been removed
   */
  silent?: boolean
  /**
   * @deprecated use __VUE_PROD_DEVTOOLS__ compile-time feature flag instead
   * https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
   */
  devtools?: boolean
  /**
   * @deprecated use `config.isCustomElement` instead
   * https://v3.vuejs.org/guide/migration/global-api.html#config-ignoredelements-is-now-config-iscustomelement
   */
  ignoredElements?: (string | RegExp)[]
  /**
   * @deprecated
   * https://v3.vuejs.org/guide/migration/keycode-modifiers.html
   */
  keyCodes?: Record<string, number | number[]>
  /**
   * @deprecated
   * https://v3.vuejs.org/guide/migration/global-api.html#config-productiontip-removed
   */
  productionTip?: boolean
}

/**
 * @deprecated the default `Vue` export has been removed in Vue 3. The type for
 * the default export is provided only for migration purposes. Please use
 * named imports instead - e.g. `import { createApp } from 'vue'`.
 */
export type GlobalVue = Pick<App, 'version' | 'component' | 'directive'> & {
  // no inference here since these types are not meant for actual use - they
  // are merely here to provide type checks for internal implementation and
  // information for migration.
  new (options?: ComponentOptions): ComponentPublicInstance

  version: string
  config: LegacyConfig

  extend: typeof defineComponent
  nextTick: typeof nextTick

  use(plugin: Plugin, ...options: any[]): GlobalVue
  mixin(mixin: ComponentOptions): GlobalVue

  component(name: string): Component | undefined
  component(name: string, component: Component): GlobalVue
  directive(name: string): Directive | undefined
  directive(name: string, directive: Directive): GlobalVue

  compile(template: string): RenderFunction

  /**
   * @deprecated Vue 3 no longer needs set() for adding new properties.
   */
  set(target: any, key: string | number | symbol, value: any): void
  /**
   * @deprecated Vue 3 no longer needs delete() for property deletions.
   */
  delete(target: any, key: string | number | symbol): void
  /**
   * @deprecated use `reactive` instead.
   */
  observable: typeof reactive
  /**
   * @deprecated filters have been removed from Vue 3.
   */
  filter(name: string, arg: any): null
}

export const Vue: GlobalVue = function Vue(options: ComponentOptions = {}) {
  const app = createApp(options)
  // copy over global config mutations
  for (const key in singletonApp.config) {
    if (
      key !== 'isNativeTag' &&
      !(key === 'isCustomElement' && isRuntimeOnly())
    ) {
      // @ts-ignore
      app.config[key] = singletonApp.config[key]
    }
  }
  if (options.el) {
    return app.mount(options.el)
  }
} as any

const singletonApp = createApp({})

Vue.version = __VERSION__
Vue.config = singletonApp.config

Vue.extend = defineComponent
Vue.nextTick = nextTick

Vue.set = (target, key, value) => {
  // TODO deprecation warnings
  target[key] = value
}
Vue.delete = (target, key) => {
  // TODO deprecation warnings
  delete target[key]
}
// TODO wrap with deprecation warning
Vue.observable = reactive

Vue.use = (p, ...options) => {
  singletonApp.use(p, ...options)
  return Vue
}

Vue.mixin = m => {
  singletonApp.mixin(m)
  return Vue
}

Vue.component = ((name: string, comp: any) => {
  if (comp) {
    singletonApp.component(name, comp)
    return Vue
  } else {
    return singletonApp.component(name)
  }
}) as any

Vue.directive = ((name: string, dir: any) => {
  if (dir) {
    singletonApp.directive(name, dir)
    return Vue
  } else {
    return singletonApp.directive(name)
  }
}) as any

Vue.filter = ((name: string, filter: any) => {
  // TODO deprecation warning
  // TODO compiler warning for filters (maybe behavior compat?)
}) as any
