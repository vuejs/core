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
  normalizeContainer,
  warn,
} from '@vue/runtime-dom'
import type { RawProps } from './componentProps'

let _createApp: CreateAppFunction<ParentNode, VaporComponent>

const mountApp: AppMountFn<ParentNode> = (app, container) => {
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
  return instance
}

const unmountApp: AppUnmountFn = app => {
  unmountComponent(app._instance as VaporComponentInstance, app._container)
}

export const createVaporApp: CreateAppFunction<ParentNode, VaporComponent> = (
  comp,
  props,
) => {
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
