import { Component, Data, validateComponentName } from './component'
import { ComponentOptions } from './apiOptions'
import { ComponentPublicInstance } from './componentProxy'
import { Directive, validateDirectiveName } from './directives'
import { RootRenderFunction } from './renderer'
import { InjectionKey } from './apiInject'
import { isFunction, NO } from '@vue/shared'
import { warn } from './warning'
import { createVNode } from './vnode'

export interface App<HostElement = any> {
  config: AppConfig
  use(plugin: Plugin, options?: any): this
  mixin(mixin: ComponentOptions): this
  component(name: string): Component | undefined
  component(name: string, component: Component): this
  directive(name: string): Directive | undefined
  directive(name: string, directive: Directive): this
  mount(
    rootComponent: Component,
    rootContainer: HostElement | string,
    rootProps?: Data
  ): ComponentPublicInstance
  provide<T>(key: InjectionKey<T> | string, value: T): this
}

export interface AppConfig {
  devtools: boolean
  performance: boolean
  readonly isNativeTag?: (tag: string) => boolean
  isCustomElement?: (tag: string) => boolean
  errorHandler?: (
    err: Error,
    instance: ComponentPublicInstance | null,
    info: string
  ) => void
  warnHandler?: (
    msg: string,
    instance: ComponentPublicInstance | null,
    trace: string
  ) => void
}

export interface AppContext {
  config: AppConfig
  mixins: ComponentOptions[]
  components: Record<string, Component>
  directives: Record<string, Directive>
  provides: Record<string | symbol, any>
}

type PluginInstallFunction = (app: App) => any

export type Plugin =
  | PluginInstallFunction
  | {
      install: PluginInstallFunction
    }

export function createAppContext(): AppContext {
  return {
    config: {
      devtools: true,
      performance: false,
      isNativeTag: NO,
      isCustomElement: NO,
      errorHandler: undefined,
      warnHandler: undefined
    },
    mixins: [],
    components: {},
    directives: {},
    provides: {}
  }
}

export function createAppAPI<HostNode, HostElement>(
  render: RootRenderFunction<HostNode, HostElement>
): () => App<HostElement> {
  return function createApp(): App {
    const context = createAppContext()

    let isMounted = false

    const app: App = {
      get config() {
        return context.config
      },

      set config(v) {
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`
          )
        }
      },

      use(plugin: Plugin) {
        if (isFunction(plugin)) {
          plugin(app)
        } else if (isFunction(plugin.install)) {
          plugin.install(app)
        } else if (__DEV__) {
          warn(
            `A plugin must either be a function or an object with an "install" ` +
              `function.`
          )
        }
        return app
      },

      mixin(mixin: ComponentOptions) {
        if (__DEV__ && !__FEATURE_OPTIONS__) {
          warn('Mixins are only available in builds supporting Options API')
        }

        if (!context.mixins.includes(mixin)) {
          context.mixins.push(mixin)
        } else if (__DEV__) {
          warn(
            'Mixin has already been applied to target app' +
              (mixin.name ? `: ${mixin.name}` : '')
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
        } else {
          if (__DEV__ && context.components[name]) {
            warn(
              `Component "${name}" has already been registered in target app.`
            )
          }
          context.components[name] = component
          return app
        }
      },

      directive(name: string, directive?: Directive) {
        if (__DEV__) {
          validateDirectiveName(name)
        }

        if (!directive) {
          return context.directives[name] as any
        } else {
          if (__DEV__ && context.directives[name]) {
            warn(
              `Directive "${name}" has already been registered in target app.`
            )
          }
          context.directives[name] = directive
          return app
        }
      },

      mount(
        rootComponent: Component,
        rootContainer: HostElement,
        rootProps?: Data
      ): any {
        if (!isMounted) {
          const vnode = createVNode(rootComponent, rootProps)
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context
          render(vnode, rootContainer)
          isMounted = true
          return vnode.component!.renderProxy
        } else if (__DEV__) {
          warn(
            `App has already been mounted. Create a new app instance instead.`
          )
        }
      },

      provide(key, value) {
        if (__DEV__ && key in context.provides) {
          warn(
            `App already provides property with key "${key}". ` +
              `It will be overwritten with the new value.`
          )
        }
        // TypeScript doesn't allow symbols as index type
        // https://github.com/Microsoft/TypeScript/issues/24587
        context.provides[key as string] = value

        return app
      }
    }

    return app
  }
}
