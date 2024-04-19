import { isFunction, isObject } from '@vue/shared'
import {
  type Component,
  type ComponentInternalInstance,
  createComponentInstance,
} from './component'
import { warn } from './warning'
import { version } from '.'
import { render, setupComponent, unmountComponent } from './apiRender'
import type { InjectionKey } from './apiInject'
import type { RawProps } from './componentProps'

export function createVaporApp(
  rootComponent: Component,
  rootProps: RawProps | null = null,
): App {
  if (rootProps != null && !isObject(rootProps) && !isFunction(rootProps)) {
    __DEV__ &&
      warn(`root props passed to app.mount() must be an object or function.`)
    rootProps = null
  }

  const context = createAppContext()
  let instance: ComponentInternalInstance

  const app: App = {
    _context: context,

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

    mount(rootContainer): any {
      if (!instance) {
        instance = createComponentInstance(
          rootComponent,
          rootProps,
          null,
          null,
          context,
        )
        setupComponent(instance)
        render(instance, rootContainer)
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
  }

  return app
}

export function createAppContext(): AppContext {
  return {
    app: null as any,
    config: {
      errorHandler: undefined,
      warnHandler: undefined,
    },
    provides: Object.create(null),
  }
}

export interface App {
  version: string
  config: AppConfig

  mount(
    rootContainer: ParentNode | string,
    isHydrate?: boolean,
  ): ComponentInternalInstance
  unmount(): void
  provide<T>(key: string | InjectionKey<T>, value: T): App
  runWithContext<T>(fn: () => T): T

  _context: AppContext
}

export interface AppConfig {
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
}

export interface AppContext {
  app: App // for devtools
  config: AppConfig
  provides: Record<string | symbol, any>
}

/**
 * @internal Used to identify the current app when using `inject()` within
 * `app.runWithContext()`.
 */
export let currentApp: App | null = null
