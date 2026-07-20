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
import { setIsHydratingEnabled, withHydration } from './dom/hydration'

let _createApp: CreateAppFunction<ParentNode, VaporComponent>
const rootInstances = new WeakMap<App, VaporComponentInstance>()

const mountApp: AppMountFn<ParentNode> = (app, container) => {
  optimizePropertyLookup()

  // clear content before mounting
  if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
    if (__DEV__ && container.childNodes.length) {
      warn('mount target container is not empty and will be cleared.')
    }
    container.textContent = ''
  }

  const instance =
    (app._ceComponent as VaporComponentInstance) ||
    createComponent(
      app._component,
      app._props as RawProps,
      null,
      false,
      false,
      app._context,
    )
  mountComponent(instance, container)
  flushOnAppMount()
  rootInstances.set(app, instance)

  return instance!
}

let _hydrateApp: CreateAppFunction<ParentNode, VaporComponent>

const hydrateApp: AppMountFn<ParentNode> = (app, container) => {
  if (!container.hasChildNodes()) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      warn(
        `Attempting to hydrate existing markup but container is empty. ` +
          `Performing full mount instead.`,
      )
    return mountApp(app, container)
  }

  optimizePropertyLookup()
  let instance: VaporComponentInstance
  withHydration(container, () => {
    instance =
      (app._ceComponent as VaporComponentInstance) ||
      createComponent(
        app._component,
        app._props as RawProps,
        null,
        false,
        false,
        app._context,
        true,
      )
    mountComponent(instance, container)
    flushOnAppMount()
  })
  rootInstances.set(app, instance!)

  return instance!
}

const unmountApp: AppUnmountFn = app => {
  const instance = ((__DEV__ && app._instance) ||
    rootInstances.get(app)!) as VaporComponentInstance
  unmountComponent(instance, app._container)
  rootInstances.delete(app)
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
  app.mount = (container, ...args: any[]): any => {
    container = normalizeContainer(container) as ParentNode
    if (!container) return

    const proxy = mount(container, ...args)
    if (container instanceof Element) {
      container.removeAttribute('v-cloak')
      container.setAttribute('data-v-app', '')
    }
    return proxy
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
  setIsHydratingEnabled(true)
  prepareApp()
  if (!_hydrateApp)
    _hydrateApp = createAppAPI(hydrateApp, unmountApp, getExposed)
  const app = _hydrateApp(comp, props)
  postPrepareApp(app)
  return app
}
