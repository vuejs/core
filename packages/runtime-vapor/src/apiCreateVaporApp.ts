import { NO, getGlobalThis, isFunction, isObject } from '@vue/shared'
import {
  type Component,
  type ComponentInternalInstance,
  createComponentInstance,
  validateComponentName,
} from './component'
import { warn } from './warning'
import { type Directive, version } from '.'
import {
  normalizeContainer,
  render,
  setupComponent,
  unmountComponent,
} from './apiRender'
import type { InjectionKey } from './apiInject'
import type { RawProps } from './componentProps'
import { validateDirectiveName } from './directives'
import { devtoolsInitApp, setDevtoolsHook } from './devtools'

let uid = 0
export function createVaporApp(
  rootComponent: Component,
  rootProps: RawProps | null = null,
): App {
  if (rootProps != null && !isObject(rootProps) && !isFunction(rootProps)) {
    __DEV__ &&
      warn(`root props passed to app.mount() must be an object or function.`)
    rootProps = null
  }

  const target = getGlobalThis()
  target.__VUE__ = true
  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__, target)
  }

  const context = createAppContext()
  const installedPlugins = new WeakSet()

  let instance: ComponentInternalInstance

  const app: App = (context.app = {
    _uid: uid++,
    _component: rootComponent,
    _props: rootProps,
    _container: null,
    _context: context,
    _instance: null,

    version,

    get config() {
      return context.config
    },

    set config(v) {
      if (__DEV__) {
        warn(
          `app.config cannot be replaced. Modify individual options instead.`,
        )
      }
    },

    use(plugin: Plugin, ...options: any[]) {
      if (installedPlugins.has(plugin)) {
        __DEV__ && warn(`Plugin has already been applied to target app.`)
      } else if (plugin && isFunction(plugin.install)) {
        installedPlugins.add(plugin)
        plugin.install(app, ...options)
      } else if (isFunction(plugin)) {
        installedPlugins.add(plugin)
        plugin(app, ...options)
      } else if (__DEV__) {
        warn(
          `A plugin must either be a function or an object with an "install" ` +
            `function.`,
        )
      }
      return app
    },

    component(name: string, component?: Component): any {
      if (__DEV__) {
        validateComponentName(name, context.config)
      }
      if (!component) {
        return context.components[name]
      }
      if (__DEV__ && context.components[name]) {
        warn(`Component "${name}" has already been registered in target app.`)
      }
      context.components[name] = component
      return app
    },

    directive(name: string, directive?: Directive) {
      if (__DEV__) {
        validateDirectiveName(name)
      }

      if (!directive) {
        return context.directives[name] as any
      }
      if (__DEV__ && context.directives[name]) {
        warn(`Directive "${name}" has already been registered in target app.`)
      }
      context.directives[name] = directive
      return app
    },

    mount(container): any {
      if (!instance) {
        container = normalizeContainer(container)
        // #5571
        if (__DEV__ && (container as any).__vue_app__) {
          warn(
            `There is already an app instance mounted on the host container.\n` +
              ` If you want to mount another app on the same host container,` +
              ` you need to unmount the previous app by calling \`app.unmount()\` first.`,
          )
        }

        // clear content before mounting
        if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
          container.textContent = ''
        }

        instance = createComponentInstance(
          rootComponent,
          rootProps,
          null,
          false,
          context,
        )
        setupComponent(instance)
        render(instance, container)

        app._container = container
        // for devtools and telemetry
        ;(container as any).__vue_app__ = app

        if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
          app._instance = instance
          devtoolsInitApp(app, version)
        }

        if (container instanceof Element) {
          container.removeAttribute('v-cloak')
          container.setAttribute('data-v-app', '')
        }

        return instance
      } else if (__DEV__) {
        warn(
          `App has already been mounted.\n` +
            `If you want to remount the same app, move your app creation logic ` +
            `into a factory function and create fresh app instances for each ` +
            `mount - e.g. \`const createMyApp = () => createApp(App)\``,
        )
      }
    },
    unmount() {
      if (instance) {
        unmountComponent(instance)
        delete (app._container as any).__vue_app__
      } else if (__DEV__) {
        warn(`Cannot unmount an app that is not mounted.`)
      }
    },
    provide(key, value) {
      if (__DEV__ && (key as string | symbol) in context.provides) {
        warn(
          `App already provides property with key "${String(key)}". ` +
            `It will be overwritten with the new value.`,
        )
      }

      context.provides[key as string | symbol] = value

      return app
    },
    runWithContext(fn) {
      const lastApp = currentApp
      currentApp = app
      try {
        return fn()
      } finally {
        currentApp = lastApp
      }
    },
  })

  return app
}

export function createAppContext(): AppContext {
  return {
    app: null as any,
    mixins: [],
    config: {
      isNativeTag: NO,
      performance: false,
      errorHandler: undefined,
      warnHandler: undefined,
      globalProperties: {},
    },
    provides: Object.create(null),
    components: {},
    directives: {},
  }
}

type PluginInstallFunction<Options = any[]> = Options extends unknown[]
  ? (app: App, ...options: Options) => any
  : (app: App, options: Options) => any

export type ObjectPlugin<Options = any[]> = {
  install: PluginInstallFunction<Options>
}
export type FunctionPlugin<Options = any[]> = PluginInstallFunction<Options> &
  Partial<ObjectPlugin<Options>>

export type Plugin<Options = any[]> =
  | FunctionPlugin<Options>
  | ObjectPlugin<Options>

export interface App {
  version: string
  config: AppConfig

  use<Options extends unknown[]>(
    plugin: Plugin<Options>,
    ...options: Options
  ): this
  use<Options>(plugin: Plugin<Options>, options: Options): this

  component(name: string): Component | undefined
  component<T extends Component>(name: string, component: T): this
  directive<T = any, V = any>(name: string): Directive<T, V> | undefined
  directive<T = any, V = any>(name: string, directive: Directive<T, V>): this

  mount(
    rootContainer: ParentNode | string,
    isHydrate?: boolean,
  ): ComponentInternalInstance
  unmount(): void
  provide<T>(key: string | InjectionKey<T>, value: T): App
  runWithContext<T>(fn: () => T): T

  // internal, but we need to expose these for the server-renderer and devtools
  _uid: number
  _component: Component
  _props: RawProps | null
  _container: ParentNode | null
  _context: AppContext
  _instance: ComponentInternalInstance | null
}

export interface AppConfig {
  // @private
  readonly isNativeTag: (tag: string) => boolean

  performance: boolean
  errorHandler?: (
    err: unknown,
    instance: ComponentInternalInstance | null,
    info: string,
  ) => void
  warnHandler?: (
    msg: string,
    instance: ComponentInternalInstance | null,
    trace: string,
  ) => void
  globalProperties: ComponentCustomProperties & Record<string, any>
}

export interface AppContext {
  app: App // for devtools
  config: AppConfig
  mixins: never[] // for devtools, but no longer supported
  provides: Record<string | symbol, any>

  /**
   * Resolved component registry, only for components with mixins or extends
   * @internal
   */
  components: Record<string, Component>
  /**
   * Resolved directive registry, only for components with mixins or extends
   * @internal
   */
  directives: Record<string, Directive>
}

/**
 * @internal Used to identify the current app when using `inject()` within
 * `app.runWithContext()`.
 */
export let currentApp: App | null = null

/**
 * Custom properties added to component instances in any way and can be accessed through `this`
 *
 * @example
 * Here is an example of adding a property `$router` to every component instance:
 * ```ts
 * import { createApp } from 'vue'
 * import { Router, createRouter } from 'vue-router'
 *
 * declare module '@vue/runtime-core' {
 *   interface ComponentCustomProperties {
 *     $router: Router
 *   }
 * }
 *
 * // effectively adding the router to every component instance
 * const app = createApp({})
 * const router = createRouter()
 * app.config.globalProperties.$router = router
 *
 * const vm = app.mount('#app')
 * // we can access the router from the instance
 * vm.$router.push('/')
 * ```
 */
export interface ComponentCustomProperties {}
