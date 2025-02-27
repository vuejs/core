import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
  getExposed,
  mountComponent,
  unmountComponent,
} from './component'
import {
  type AppMountFn,
  type AppUnmountFn,
  type CreateAppFunction,
  createAppAPI,
  flushOnAppMount,
  initFeatureFlags,
  normalizeContainer,
  setDevtoolsHook,
  warn,
} from '@vue/runtime-dom'
import type { RawProps } from './componentProps'
import { getGlobalThis } from '@vue/shared'
import { optimizePropertyLookup } from './dom/prop'
import { ensureVaporTransition } from './components/Transition'

let _createApp: CreateAppFunction<ParentNode, VaporComponent>

const mountApp: AppMountFn<ParentNode> = (app, container) => {
  optimizePropertyLookup()
  ensureVaporTransition()

  // clear content before mounting
  if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
    container.textContent = ''
  }

  const instance = createComponent(
    app._component,
    app._props as RawProps,
    null,
    false,
    app._context,
  )

  mountComponent(instance, container)
  flushOnAppMount()

  return instance
}

const unmountApp: AppUnmountFn = app => {
  unmountComponent(app._instance as VaporComponentInstance, app._container)
}

export const createVaporApp: CreateAppFunction<ParentNode, VaporComponent> = (
  comp,
  props,
) => {
  // compile-time feature flags check
  if (__ESM_BUNDLER__ && !__TEST__) {
    initFeatureFlags()
  }

  const target = getGlobalThis()
  target.__VUE__ = true
  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__, target)
  }

  if (!_createApp) _createApp = createAppAPI(mountApp, unmountApp, getExposed)
  const app = _createApp(comp, props)

  if (__DEV__) {
    app.config.globalProperties = new Proxy(
      {},
      {
        set() {
          warn(`app.config.globalProperties is not supported in vapor mode.`)
          return false
        },
      },
    )
  }

  const mount = app.mount
  app.mount = (container, ...args: any[]) => {
    container = normalizeContainer(container) as ParentNode
    return mount(container, ...args)
  }
  return app
}
