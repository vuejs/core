import { isObject } from '@vue/shared'
import {
  type Component,
  type ComponentInternalInstance,
  createComponentInstance,
} from './component'
import { warn } from './warning'
import { version } from '.'
import { render, setupComponent, unmountComponent } from './apiRender'
import type { RawProps } from './componentProps'

export function createVaporApp(
  rootComponent: Component,
  rootProps: RawProps | null = null,
): App {
  if (rootProps != null && !isObject(rootProps)) {
    __DEV__ && warn(`root props passed to app.mount() must be an object.`)
    rootProps = null
  }

  const context = createAppContext()
  let instance: ComponentInternalInstance

  const app: App = {
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
        instance = createComponentInstance(rootComponent, rootProps)
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
  }

  return app
}

function createAppContext(): AppContext {
  return {
    app: null as any,
    config: {
      errorHandler: undefined,
      warnHandler: undefined,
    },
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
}
