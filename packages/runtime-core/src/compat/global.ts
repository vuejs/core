import { reactive } from '@vue/reactivity'
import { extend } from '@vue/shared'
import { createApp } from '../../../runtime-dom/src'
import { App, AppConfig, Plugin } from '../apiCreateApp'
import { defineComponent } from '../apiDefineComponent'
import { Component, ComponentOptions, isRuntimeOnly } from '../component'
import { RenderFunction } from '../componentOptions'
import { ComponentPublicInstance } from '../componentPublicInstance'
import { Directive } from '../directives'
import { nextTick } from '../scheduler'

/**
 * @deprecated the default `Vue` export has been removed in Vue 3. The type for
 * the default export is provided only for migration purposes. Please use
 * named imports instead - e.g. `import { createApp } from 'vue'`.
 */
export type CompatVue = Pick<App, 'version' | 'component' | 'directive'> & {
  // no inference here since these types are not meant for actual use - they
  // are merely here to provide type checks for internal implementation and
  // information for migration.
  new (options?: ComponentOptions): ComponentPublicInstance

  version: string
  config: AppConfig

  extend: typeof defineComponent
  nextTick: typeof nextTick

  use(plugin: Plugin, ...options: any[]): CompatVue
  mixin(mixin: ComponentOptions): CompatVue

  component(name: string): Component | undefined
  component(name: string, component: Component): CompatVue
  directive(name: string): Directive | undefined
  directive(name: string, directive: Directive): CompatVue

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

export let isCopyingConfig = false

// Legacy global Vue constructor
export function createCompatVue(): CompatVue {
  if (!__COMPAT__) {
    // @ts-ignore this function will never be called in non-compat mode
    return
  }

  const Vue: CompatVue = function Vue(options: ComponentOptions = {}) {
    return createCompatApp(options, Vue)
  } as any

  const singletonApp = createApp({})

  function createCompatApp(options: ComponentOptions = {}, Ctor: any) {
    const app = createApp(options)

    // copy over global config mutations
    isCopyingConfig = true
    for (const key in singletonApp.config) {
      if (
        key !== 'isNativeTag' &&
        !(key === 'isCustomElement' && isRuntimeOnly())
      ) {
        // @ts-ignore
        app.config[key] = singletonApp.config[key]
      }
    }
    isCopyingConfig = false

    // copy prototype augmentations as config.globalProperties
    for (const key in Ctor.prototype) {
      app.config.globalProperties[key] = Ctor.prototype[key]
    }

    const vm = app._createRoot!(options)
    if (options.el) {
      return (vm as any).$mount(options.el)
    } else {
      return vm
    }
  }

  Vue.version = __VERSION__
  Vue.config = singletonApp.config

  Vue.extend = ((options: ComponentOptions = {}) => {
    function SubVue(inlineOptions?: ComponentOptions) {
      if (!inlineOptions) {
        return createCompatApp(options, SubVue)
      } else {
        return createCompatApp(
          {
            el: inlineOptions.el,
            extends: options,
            mixins: [inlineOptions]
          },
          SubVue
        )
      }
    }
    SubVue.prototype = Object.create(Vue.prototype)
    SubVue.prototype.constructor = SubVue
    return SubVue
  }) as any

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

  return Vue
}
