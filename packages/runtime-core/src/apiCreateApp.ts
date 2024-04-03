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
 * 创建一个应用上下文对象。
 * 该函数没有参数。
 * @returns {AppContext} 返回一个包含应用相关配置和状态的对象。
 */
export function createAppContext(): AppContext {
  return {
    // 应用实例，初始为null
    app: null as any,
    // 应用配置对象
    config: {
      isNativeTag: NO, // 是否为原生标签
      performance: false, // 是否开启性能监控
      globalProperties: {}, // 全局属性
      optionMergeStrategies: {}, // 选项合并策略
      errorHandler: undefined, // 错误处理函数
      warnHandler: undefined, // 警告处理函数
      compilerOptions: {}, // 编译器选项
    },
    // 混合对象数组
    mixins: [],
    // 组件对象字典
    components: {},
    // 指令对象字典
    directives: {},
    // 提供的对象，键值对形式，初始为空对象
    provides: Object.create(null),
    // 选项缓存，使用WeakMap存储，用于缓存组件选项
    optionsCache: new WeakMap(),
    // 属性缓存，使用WeakMap存储，用于缓存组件属性
    propsCache: new WeakMap(),
    // 事件发射缓存，使用WeakMap存储
    emitsCache: new WeakMap(),
  }
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
  rootProps?: Data | null,
) => App<HostElement>

let uid = 0

/**
 * 创建一个应用API
 * @param render 根渲染函数，负责渲染应用的根组件
 * @param hydrate 可选的根 hydrate 函数，用于在服务器端渲染的应用上进行客户端 hydration
 * @returns 返回一个创建应用实例的函数
 */
export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
  hydrate?: RootHydrateFunction,
): CreateAppFunction<HostElement> {
  /**
   * 创建应用实例。
   * @param rootComponent 应用的根组件。
   * @param rootProps 根组件的属性，默认为 null。
   * @returns 返回应用实例。
   */
  return function createApp(rootComponent, rootProps = null) {
    // 校验 rootComponent 是否为函数，如果不是则将其转换为普通对象
    if (!isFunction(rootComponent)) {
      rootComponent = extend({}, rootComponent)
    }

    // 校验 rootProps 是否为对象，如果不是则设置为 null，并在开发环境下给出警告
    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }

    // 创建应用上下文
    const context = createAppContext()
    // 创建用于存储已安装插件的 WeakSet
    const installedPlugins = new WeakSet()

    // 标记应用是否已挂载
    let isMounted = false

    // 定义应用实例
    const app: App = (context.app = {
      _uid: uid++, // 应用实例的唯一标识
      _component: rootComponent as ConcreteComponent, // 根组件
      _props: rootProps, // 根组件的属性
      _container: null, // 容器元素，初始为 null
      _context: context, // 应用上下文
      _instance: null, // 实例，初始为 null

      version, // 应用版本

      // config 属性的存取器
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

      // use 方法，用于安装插件
      use(plugin: Plugin, ...options: any[]) {
        // 检查插件是否已安装，如果是则给出警告
        if (installedPlugins.has(plugin)) {
          __DEV__ && warn(`Plugin has already been applied to target app.`)
        } else if (plugin && isFunction(plugin.install)) {
          // 如果插件有 install 方法，则调用该方法安装插件
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) {
          // 如果插件本身是函数，则直接调用该函数
          installedPlugins.add(plugin)
          plugin(app, ...options)
        } else if (__DEV__) {
          // 在开发环境下，如果插件既没有 install 方法也不是函数，则给出警告
          warn(
            `A plugin must either be a function or an object with an "install" ` +
              `function.`,
          )
        }
        return app // 支持链式调用
      },

      // mixin 方法，用于混入组件选项
      mixin(mixin: ComponentOptions) {
        if (__FEATURE_OPTIONS_API__) {
          // 如果支持 Options API，则检查混入是否已应用，如果是则给出警告
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
          } else if (__DEV__) {
            warn(
              'Mixin has already been applied to target app' +
                (mixin.name ? `: ${mixin.name}` : ''),
            )
          }
        } else if (__DEV__) {
          // 在开发环境下，如果不支持 Options API，则给出相应警告
          warn('Mixins are only available in builds supporting Options API')
        }
        return app // 支持链式调用
      },

      // component 方法，用于注册或获取组件
      component(name: string, component?: Component): any {
        if (__DEV__) {
          // 在开发环境下，校验组件名称
          validateComponentName(name, context.config)
        }
        if (!component) {
          // 如果没有传入组件，则返回已注册的组件
          return context.components[name]
        }
        if (__DEV__ && context.components[name]) {
          // 在开发环境下，如果组件已注册，则给出警告
          warn(`Component "${name}" has already been registered in target app.`)
        }
        // 注册组件
        context.components[name] = component
        return app // 支持链式调用
      },

      // directive 方法，用于注册或获取指令
      directive(name: string, directive?: Directive) {
        if (__DEV__) {
          // 在开发环境下，校验指令名称
          validateDirectiveName(name)
        }

        if (!directive) {
          // 如果没有传入指令，则返回已注册的指令
          return context.directives[name] as any
        }
        if (__DEV__ && context.directives[name]) {
          // 在开发环境下，如果指令已注册，则给出警告
          warn(`Directive "${name}" has already been registered in target app.`)
        }
        // 注册指令
        context.directives[name] = directive
        return app // 支持链式调用
      },

      // mount 方法，用于将应用挂载到一个容器上
      mount(
        rootContainer: HostElement,
        isHydrate?: boolean,
        namespace?: boolean | ElementNamespace,
      ): any {
        if (!isMounted) {
          // #5571
          // 在开发环境下，如果容器上已挂载其他应用实例，则给出警告
          if (__DEV__ && (rootContainer as any).__vue_app__) {
            warn(
              `There is already an app instance mounted on the host container.\n` +
                ` If you want to mount another app on the same host container,` +
                ` you need to unmount the previous app by calling \`app.unmount()\` first.`,
            )
          }
          // 创建根虚拟节点，并设置应用上下文
          const vnode = createVNode(rootComponent, rootProps)
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context

          // 处理命名空间
          if (namespace === true) {
            namespace = 'svg'
          } else if (namespace === false) {
            namespace = undefined
          }

          // HMR root reload
          // 热替换相关的设置
          if (__DEV__) {
            context.reload = () => {
              // casting to ElementNamespace because TS doesn't guarantee type narrowing
              // over function boundaries
              render(
                cloneVNode(vnode),
                rootContainer,
                namespace as ElementNamespace,
              )
            }
          }

          // 根据是否是 hydration 模式，调用不同的渲染函数
          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            // 利用渲染器渲染vnode
            render(vnode, rootContainer, namespace)
          }
          // 设置应用实例的相关状态和属性
          isMounted = true
          app._container = rootContainer
          // for devtools and telemetry
          ;(rootContainer as any).__vue_app__ = app

          // 开发环境或生产环境下的 devtools 相关初始化
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = vnode.component
            devtoolsInitApp(app, version)
          }

          // 返回根组件的代理对象
          return getExposeProxy(vnode.component!) || vnode.component!.proxy
        } else if (__DEV__) {
          // 如果是在开发环境，且尝试多次挂载，则抛出警告
          warn(
            `App has already been mounted.\n` +
              `If you want to remount the same app, move your app creation logic ` +
              `into a factory function and create fresh app instances for each ` +
              `mount - e.g. \`const createMyApp = () => createApp(App)\``,
          )
        }
      },

      /**
       * 卸载应用。
       * 如果应用已挂载，则将当前应用从容器中移除，并进行相关的开发工具或生产环境下的调试操作。
       * 如果应用未挂载，在开发环境下会发出警告。
       */
      unmount() {
        if (isMounted) {
          // 从容器中移除当前应用的渲染内容
          render(null, app._container)
          // 如果在开发环境或支持的生产环境下，清除实例并通知开发工具应用已卸载
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = null
            devtoolsUnmountApp(app)
          }
          // 清理应用容器的引用
          delete app._container.__vue_app__
        } else if (__DEV__) {
          // 在开发环境下，如果应用未挂载则发出警告
          warn(`Cannot unmount an app that is not mounted.`)
        }
      },

      /**
       * 提供一个服务或变量给应用上下文。
       * @param key 服务或变量的键，可以是字符串或符号。
       * @param value 对应键的值。
       * @returns 返回当前应用实例以支持链式调用。
       */
      provide(key, value) {
        // 在开发环境下，如果尝试提供已存在的服务或变量，则发出警告
        if (__DEV__ && (key as string | symbol) in context.provides) {
          warn(
            `App already provides property with key "${String(key)}". ` +
              `It will be overwritten with the new value.`,
          )
        }

        // 提供服务或变量
        context.provides[key as string | symbol] = value

        return app // 支持链式调用
      },

      /**
       * 在给定的上下文中运行函数。
       * @param fn 要在特定上下文中运行的函数。
       * @returns 执行函数的结果。
       */
      runWithContext(fn) {
        // 保存当前应用，以便在函数执行完毕后恢复
        const lastApp = currentApp
        currentApp = app
        try {
          // 在新的上下文中执行函数
          return fn()
        } finally {
          // 恢复之前的上下文
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
