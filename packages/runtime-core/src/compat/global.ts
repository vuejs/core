import { reactive } from '@vue/reactivity'
import { isFunction } from '@vue/shared'
import { warn } from '../warning'
import { cloneVNode, createVNode } from '../vnode'
import { RootRenderFunction } from '../renderer'
import { RootHydrateFunction } from '../hydration'
import {
  App,
  AppConfig,
  AppContext,
  CreateAppFunction,
  Plugin
} from '../apiCreateApp'
import { defineComponent } from '../apiDefineComponent'
import {
  Component,
  ComponentOptions,
  createComponentInstance,
  finishComponentSetup,
  isRuntimeOnly,
  setupComponent
} from '../component'
import { RenderFunction } from '../componentOptions'
import { ComponentPublicInstance } from '../componentPublicInstance'
import { devtoolsInitApp } from '../devtools'
import { Directive } from '../directives'
import { nextTick } from '../scheduler'
import { warnDeprecation, DeprecationTypes } from './deprecations'
import { version } from '..'

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
  config: AppConfig & LegacyConfig

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

// legacy config warnings
export type LegacyConfig = {
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

export let isCopyingConfig = false

// Legacy global Vue constructor
export function createCompatVue(
  createApp: CreateAppFunction<Element>
): CompatVue {
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
    let hasPrototypeAugmentations = false
    for (const key in Ctor.prototype) {
      if (key !== 'constructor') {
        hasPrototypeAugmentations = true
      }
      app.config.globalProperties[key] = Ctor.prototype[key]
    }
    if (hasPrototypeAugmentations) {
      __DEV__ && warnDeprecation(DeprecationTypes.GLOBAL_PROTOTYPE)
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
        const { el, data } = inlineOptions
        if (data && !isFunction(data)) {
          __DEV__ && warnDeprecation(DeprecationTypes.OPTIONS_DATA_FN)
          inlineOptions.data = () => data
        }
        return createCompatApp(
          {
            el,
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
    __DEV__ && warnDeprecation(DeprecationTypes.GLOBAL_SET)
    target[key] = value
  }

  Vue.delete = (target, key) => {
    __DEV__ && warnDeprecation(DeprecationTypes.GLOBAL_DELETE)
    delete target[key]
  }

  Vue.observable = __DEV__
    ? (target: any) => {
        warnDeprecation(DeprecationTypes.GLOBAL_OBSERVABLE)
        return reactive(target)
      }
    : reactive

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

export function installCompatMount(
  app: App,
  context: AppContext,
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
) {
  let isMounted = false

  /**
   * Vue 2 supports the behavior of creating a component instance but not
   * mounting it, which is no longer possible in Vue 3 - this internal
   * function simulates that behavior.
   */
  app._createRoot = options => {
    const component = app._component
    const vnode = createVNode(component, options.propsData || null)
    vnode.appContext = context

    const hasNoRender =
      !isFunction(component) && !component.render && !component.template
    const emptyRender = () => {}

    // create root instance
    const instance = createComponentInstance(vnode, null, null)
    // suppress "missing render fn" warning since it can't be determined
    // until $mount is called
    if (hasNoRender) {
      instance.render = emptyRender
    }
    setupComponent(instance, __NODE_JS__)
    vnode.component = instance

    // $mount & $destroy
    // these are defined on ctx and picked up by the $mount/$destroy
    // public property getters on the instance proxy.
    // Note: the following assumes DOM environment since the compat build
    // only targets web. It essentially includes logic for app.mount from
    // both runtime-core AND runtime-dom.
    instance.ctx._compat_mount = (selectorOrEl: string | Element) => {
      if (isMounted) {
        __DEV__ && warn(`Root instance is already mounted.`)
        return
      }

      let container: Element
      if (typeof selectorOrEl === 'string') {
        // eslint-disable-next-line
        const result = document.querySelector(selectorOrEl)
        if (!result) {
          __DEV__ &&
            warn(
              `Failed to mount root instance: selector "${selectorOrEl}" returned null.`
            )
          return
        }
        container = result
      } else {
        if (!selectorOrEl) {
          __DEV__ &&
            warn(
              `Failed to mount root instance: invalid mount target ${selectorOrEl}.`
            )
          return
        }
        container = selectorOrEl
      }

      const isSVG = container instanceof SVGElement

      // HMR root reload
      if (__DEV__) {
        context.reload = () => {
          const cloned = cloneVNode(vnode)
          // compat mode will use instance if not reset to null
          cloned.component = null
          render(cloned, container, isSVG)
        }
      }

      // resolve in-DOM template if component did not provide render
      // and no setup/mixin render functions are provided (by checking
      // that the instance is still using the placeholder render fn)
      if (hasNoRender && instance.render === emptyRender) {
        // root directives check
        if (__DEV__) {
          for (let i = 0; i < container.attributes.length; i++) {
            const attr = container.attributes[i]
            if (attr.name !== 'v-cloak' && /^(v-|:|@)/.test(attr.name)) {
              warnDeprecation(DeprecationTypes.GLOBAL_DOM_TEMPLATE_MOUNT)
              break
            }
          }
        }
        instance.render = null
        ;(component as ComponentOptions).template = container.innerHTML
        finishComponentSetup(instance, __NODE_JS__, true /* skip options */)
      }

      // clear content before mounting
      container.innerHTML = ''

      // TODO hydration
      render(vnode, container, isSVG)

      if (container instanceof Element) {
        container.removeAttribute('v-cloak')
        container.setAttribute('data-v-app', '')
      }

      isMounted = true
      app._container = container
      // for devtools and telemetry
      ;(container as any).__vue_app__ = app
      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsInitApp(app, version)
      }

      return instance.proxy!
    }

    instance.ctx._compat_destroy = app.unmount

    return instance.proxy!
  }
}

// dev only
export function installLegacyConfigTraps(config: AppConfig) {
  const legacyConfigOptions: Record<string, DeprecationTypes> = {
    silent: DeprecationTypes.CONFIG_SILENT,
    devtools: DeprecationTypes.CONFIG_DEVTOOLS,
    ignoredElements: DeprecationTypes.CONFIG_IGNORED_ELEMENTS,
    keyCodes: DeprecationTypes.CONFIG_KEY_CODES,
    productionTip: DeprecationTypes.CONFIG_PRODUCTION_TIP
  }

  Object.keys(legacyConfigOptions).forEach(key => {
    let val = (config as any)[key]
    Object.defineProperty(config, key, {
      enumerable: true,
      get() {
        return val
      },
      set(newVal) {
        if (!isCopyingConfig) {
          warnDeprecation(legacyConfigOptions[key])
        }
        val = newVal
      }
    })
  })
}
