import {
  isReactive,
  reactive,
  track,
  TrackOpTypes,
  trigger,
  TriggerOpTypes
} from '@vue/reactivity'
import {
  isFunction,
  extend,
  NOOP,
  EMPTY_OBJ,
  isArray,
  isObject
} from '@vue/shared'
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
import { RenderFunction, mergeOptions } from '../componentOptions'
import { ComponentPublicInstance } from '../componentPublicInstance'
import { devtoolsInitApp } from '../devtools'
import { Directive } from '../directives'
import { nextTick } from '../scheduler'
import { version } from '..'
import { LegacyConfig } from './globalConfig'
import { LegacyDirective } from './customDirective'
import {
  warnDeprecation,
  DeprecationTypes,
  assertCompatEnabled,
  configureCompat,
  isCompatEnabled,
  softAssertCompatEnabled
} from './compatConfig'

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

  configureCompat: typeof configureCompat
}

export let isCopyingConfig = false

// Legacy global Vue constructor
export function createCompatVue(
  createApp: CreateAppFunction<Element>
): CompatVue {
  const Vue: CompatVue = function Vue(options: ComponentOptions = {}) {
    return createCompatApp(options, Vue)
  } as any

  const singletonApp = createApp({})

  function createCompatApp(options: ComponentOptions = {}, Ctor: any) {
    assertCompatEnabled(DeprecationTypes.GLOBAL_MOUNT, null)

    const { data } = options
    if (
      data &&
      !isFunction(data) &&
      softAssertCompatEnabled(DeprecationTypes.OPTIONS_DATA_FN, null)
    ) {
      options.data = () => data
    }

    const app = createApp(options)

    // copy over asset registries and deopt flag
    ;['mixins', 'components', 'directives', 'deopt'].forEach(key => {
      // @ts-ignore
      app._context[key] = singletonApp._context[key]
    })

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
    if (isCompatEnabled(DeprecationTypes.GLOBAL_PROTOTYPE, null)) {
      app.config.globalProperties = Ctor.prototype
    }
    let hasPrototypeAugmentations = false
    for (const key in Ctor.prototype) {
      if (key !== 'constructor') {
        hasPrototypeAugmentations = true
        break
      }
    }
    if (__DEV__ && hasPrototypeAugmentations) {
      warnDeprecation(DeprecationTypes.GLOBAL_PROTOTYPE, null)
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
  Vue.nextTick = nextTick

  Vue.extend = ((options: ComponentOptions = {}) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_EXTEND, null)

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

  Vue.set = (target, key, value) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_SET, null)
    target[key] = value
  }

  Vue.delete = (target, key) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_DELETE, null)
    delete target[key]
  }

  Vue.observable = (target: any) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_OBSERVABLE, null)
    return reactive(target)
  }

  Vue.use = (p, ...options) => {
    singletonApp.use(p, ...options)
    return Vue
  }

  Vue.mixin = m => {
    singletonApp.mixin(m)
    return Vue
  }

  Vue.component = ((name: string, comp: Component) => {
    if (comp) {
      singletonApp.component(name, comp)
      return Vue
    } else {
      return singletonApp.component(name)
    }
  }) as any

  Vue.directive = ((name: string, dir: Directive | LegacyDirective) => {
    if (dir) {
      singletonApp.directive(name, dir as Directive)
      return Vue
    } else {
      return singletonApp.directive(name)
    }
  }) as any

  Vue.filter = ((name: string, filter: any) => {
    // TODO deprecation warning
    // TODO compiler warning for filters (maybe behavior compat?)
  }) as any

  // internal utils - these are technically internal but some plugins use it.
  const util = {
    warn: __DEV__ ? warn : NOOP,
    extend,
    mergeOptions: (parent: any, child: any, vm?: ComponentPublicInstance) =>
      mergeOptions(parent, child, vm && vm.$),
    defineReactive
  }
  Object.defineProperty(Vue, 'util', {
    get() {
      assertCompatEnabled(DeprecationTypes.GLOBAL_UTIL, null)
      return util
    }
  })

  Vue.configureCompat = configureCompat

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
    setupComponent(instance)
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
              warnDeprecation(DeprecationTypes.GLOBAL_MOUNT_CONTAINER, null)
              break
            }
          }
        }
        instance.render = null
        ;(component as ComponentOptions).template = container.innerHTML
        finishComponentSetup(instance, false, true /* skip options */)
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

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

const patched = new WeakSet<object>()

function defineReactive(obj: any, key: string, val: any) {
  // it's possible for the orignial object to be mutated after being defined
  // and expecting reactivity... we are covering it here because this seems to
  // be a bit more common.
  if (isObject(val) && !isReactive(val) && !patched.has(val)) {
    const reactiveVal = reactive(val)
    if (isArray(val)) {
      methodsToPatch.forEach(m => {
        // @ts-ignore
        val[m] = (...args: any[]) => {
          // @ts-ignore
          Array.prototype[m].call(reactiveVal, ...args)
        }
      })
    } else {
      Object.keys(val).forEach(key => {
        defineReactiveSimple(val, key, val[key])
      })
    }
  }

  const i = obj.$
  if (i && obj === i.proxy) {
    // Vue instance, add it to data
    if (i.data === EMPTY_OBJ) {
      i.data = reactive({})
    }
    i.data[key] = val
    i.accessCache = Object.create(null)
  } else if (isReactive(obj)) {
    obj[key] = val
  } else {
    defineReactiveSimple(obj, key, val)
  }
}

function defineReactiveSimple(obj: any, key: string, val: any) {
  val = isObject(val) ? reactive(val) : val
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      track(obj, TrackOpTypes.GET, key)
      return val
    },
    set(newVal) {
      val = isObject(newVal) ? reactive(newVal) : newVal
      trigger(obj, TriggerOpTypes.SET, key, newVal)
    }
  })
}
