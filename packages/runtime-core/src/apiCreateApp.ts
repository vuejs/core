import {
  type Component,
  type ComponentInternalInstance,
  type ConcreteComponent,
  type Data,
  getExposeProxy,
  validateComponentName,
} from './component'
import type {
  ComponentOptions,
  MergedComponentOptions,
  RuntimeCompilerOptions,
} from './componentOptions'
import type {
  ComponentCustomProperties,
  ComponentPublicInstance,
} from './componentPublicInstance'
import { type Directive, validateDirectiveName } from './directives'
import type { ElementNamespace, RootRenderFunction } from './renderer'
import type { InjectionKey } from './apiInject'
import { warn } from './warning'
import { type VNode, cloneVNode, createVNode } from './vnode'
import type { RootHydrateFunction } from './hydration'
import { devtoolsInitApp, devtoolsUnmountApp } from './devtools'
import { NO, extend, isFunction, isObject } from '@vue/shared'
import { version } from '.'
import { installAppCompatProperties } from './compat/global'
import type { NormalizedPropsOptions } from './componentProps'
import type { ObjectEmitsOptions } from './componentEmits'
import type { DefineComponent } from './apiDefineComponent'

export interface App<HostElement = any> {
  version: string
  config: AppConfig

  use<Options extends unknown[]>(
    plugin: Plugin<Options>,
    ...options: Options
  ): this
  use<Options>(plugin: Plugin<Options>, options: Options): this

  mixin(mixin: ComponentOptions): this
  component(name: string): Component | undefined
  component(name: string, component: Component | DefineComponent): this
  directive<T = any, V = any>(name: string): Directive<T, V> | undefined
  directive<T = any, V = any>(name: string, directive: Directive<T, V>): this
  mount(
    rootContainer: HostElement | string,
    isHydrate?: boolean,
    namespace?: boolean | ElementNamespace,
  ): ComponentPublicInstance
  unmount(): void
  provide<T>(key: InjectionKey<T> | string, value: T): this

  /**
   * Runs a function with the app as active instance. This allows using of `inject()` within the function to get access
   * to variables provided via `app.provide()`.
   *
   * @param fn - function to run with the app as active instance
   */
  runWithContext<T>(fn: () => T): T

  // internal, but we need to expose these for the server-renderer and devtools
  _uid: number
  _component: ConcreteComponent
  _props: Data | null
  _container: HostElement | null
  _context: AppContext
  _instance: ComponentInternalInstance | null

  /**
   * v2 compat only
   */
  filter?(name: string): Function | undefined
  filter?(name: string, filter: Function): this

  /**
   * @internal v3 compat only
   */
  _createRoot?(options: ComponentOptions): ComponentPublicInstance
}

export type OptionMergeFunction = (to: unknown, from: unknown) => any

export interface AppConfig {
  // @private
  readonly isNativeTag: (tag: string) => boolean

  performance: boolean
  optionMergeStrategies: Record<string, OptionMergeFunction>
  globalProperties: ComponentCustomProperties & Record<string, any>
  errorHandler?: (
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string,
  ) => void
  warnHandler?: (
    msg: string,
    instance: ComponentPublicInstance | null,
    trace: string,
  ) => void

  /**
   * Options to pass to `@vue/compiler-dom`.
   * Only supported in runtime compiler build.
   */
  compilerOptions: RuntimeCompilerOptions

  /**
   * @deprecated use config.compilerOptions.isCustomElement
   */
  isCustomElement?: (tag: string) => boolean

  /**
   * TODO document for 3.5
   * Enable warnings for computed getters that recursively trigger itself.
   */
  warnRecursiveComputed?: boolean
}

export interface AppContext {
  app: App // for devtools
  config: AppConfig
  mixins: ComponentOptions[]
  components: Record<string, Component>
  directives: Record<string, Directive>
  provides: Record<string | symbol, any>

  /**
   * Cache for merged/normalized component options
   * Each app instance has its own cache because app-level global mixins and
   * optionMergeStrategies can affect merge behavior.
   * @internal
   */
  optionsCache: WeakMap<ComponentOptions, MergedComponentOptions>
  /**
   * Cache for normalized props options
   * @internal
   */
  propsCache: WeakMap<ConcreteComponent, NormalizedPropsOptions>
  /**
   * Cache for normalized emits options
   * @internal
   */
  emitsCache: WeakMap<ConcreteComponent, ObjectEmitsOptions | null>
  /**
   * HMR only
   * @internal
   */
  reload?: () => void
  /**
   * v2 compat only
   * @internal
   */
  filters?: Record<string, Function>
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

/**
 * 创建 app 上下文
 * @returns
 */
export function createAppContext(): AppContext {
  return {
    app: null as any,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {},
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap(),
  }
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
  rootProps?: Data | null,
) => App<HostElement>

let uid = 0

/**
 * 真正开始创建应用实例的地方
 * 返回一个 createApp 函数，该函数的返回值是 app 实例对象
 * 就是我们 vue 中创建应用实例的函数以及其返回值 app 实例对象
 * app 是一个包含 mount、component、directive、use、provide 等方法的对象
 *
 * @param render 渲染函数
 * @param hydrate 服务端渲染
 * @returns createApp(rootComponent, rootProps)
 */
export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
  hydrate?: RootHydrateFunction,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent, rootProps = null) {
    if (!isFunction(rootComponent)) {
      rootComponent = extend({}, rootComponent)
    }

    if (rootProps != null && !isObject(rootProps)) {
      rootProps = null
    }

    const context = createAppContext()
    const installedPlugins = new WeakSet()

    let isMounted = false

    const app: App = (context.app = {
      _uid: uid++,
      _component: rootComponent as ConcreteComponent,
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
        if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin)
          plugin(app, ...options)
        }
        return app
      },

      mixin(mixin: ComponentOptions) {
        if (__FEATURE_OPTIONS_API__) {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
          }
        }
        return app
      },

      component(name: string, component?: Component): any {
        if (!component) {
          return context.components[name]
        }
        context.components[name] = component
        return app
      },

      directive(name: string, directive?: Directive) {
        if (!directive) {
          return context.directives[name] as any
        }
        context.directives[name] = directive
        return app
      },

      mount(
        rootContainer: HostElement,
        isHydrate?: boolean,
        namespace?: boolean | ElementNamespace,
      ): any {
        if (!isMounted) {
          const vnode = createVNode(rootComponent, rootProps)
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context

          if (namespace === true) {
            namespace = 'svg'
          } else if (namespace === false) {
            namespace = undefined
          }

          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            render(vnode, rootContainer, namespace)
          }
          isMounted = true
          app._container = rootContainer
          // for devtools and telemetry
          ;(rootContainer as any).__vue_app__ = app

          return getExposeProxy(vnode.component!) || vnode.component!.proxy
        }
      },

      unmount() {
        if (isMounted) {
          render(null, app._container)
          delete app._container.__vue_app__
        }
      },

      provide(key, value) {
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

    if (__COMPAT__) {
      installAppCompatProperties(app, context, render)
    }

    return app
  }
}

/**
 * @internal Used to identify the current app when using `inject()` within
 * `app.runWithContext()`.
 */
export let currentApp: App<unknown> | null = null
