import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
  getExposed,
  mountComponent,
  unmountComponent,
} from './component'
import {
  type App,
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
import { withHydration } from './dom/hydration'

let _createApp: CreateAppFunction<ParentNode, VaporComponent>

const mountApp: AppMountFn<ParentNode> = (app, container) => {
  optimizePropertyLookup()

  // clear content before mounting
  if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
    if (__DEV__ && container.childNodes.length) {
      warn('mount target container is not empty and will be cleared.')
    }
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

  return instance!
}

let _hydrateApp: CreateAppFunction<ParentNode, VaporComponent>

const hydrateApp: AppMountFn<ParentNode> = (app, container) => {
  optimizePropertyLookup()

  let instance: VaporComponentInstance
  withHydration(container, () => {
    instance = createComponent(
      app._component,
      app._props as RawProps,
      null,
      false,
      app._context,
    )
    mountComponent(instance, container)
    flushOnAppMount()
  })

  return instance!
}

const unmountApp: AppUnmountFn = app => {
  unmountComponent(app._instance as VaporComponentInstance, app._container)
}

function prepareApp() {
  // compile-time feature flags check
  if (__ESM_BUNDLER__ && !__TEST__) {
    initFeatureFlags()
  }

  const target = getGlobalThis()
  target.__VUE__ = true
  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__, target)
  }
}

function postPrepareApp(app: App) {
  app.vapor = true
  const mount = app.mount
  app.mount = (container, ...args: any[]) => {
    container = normalizeContainer(container) as ParentNode
    return mount(container, ...args)
  }
}

export const createVaporApp: CreateAppFunction<ParentNode, VaporComponent> = (
  comp,
  props,
) => {
  prepareApp()
  if (!_createApp) _createApp = createAppAPI(mountApp, unmountApp, getExposed)
  const app = _createApp(comp, props)
  postPrepareApp(app)
  return app
}

export const createVaporSSRApp: CreateAppFunction<
  ParentNode,
  VaporComponent
> = (comp, props) => {
  prepareApp()
  if (!_hydrateApp)
    _hydrateApp = createAppAPI(hydrateApp, unmountApp, getExposed)
  const app = _hydrateApp(comp, props)
  postPrepareApp(app)
  return app
}
