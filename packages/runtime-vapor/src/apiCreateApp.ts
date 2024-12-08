import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
  mountComponent,
  unmountComponent,
} from './component'
import {
  type AppMountFn,
  type AppUnmountFn,
  type CreateAppFunction,
  createAppAPI,
  normalizeContainer,
} from '@vue/runtime-dom'
import type { RawProps } from './componentProps'

let _createApp: CreateAppFunction<ParentNode, VaporComponent>

const mountApp: AppMountFn<ParentNode> = (app, container) => {
  // clear content before mounting
  if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
    container.textContent = ''
  }
  const instance = createComponent(app._component, app._props as RawProps)
  mountComponent(instance, container)
  return instance
}

const unmountApp: AppUnmountFn = app => {
  unmountComponent(app._instance as VaporComponentInstance, app._container)
}

export const createVaporApp: CreateAppFunction<
  ParentNode,
  VaporComponent
> = comp => {
  if (!_createApp)
    _createApp = createAppAPI(mountApp, unmountApp, i => i.exposed)
  const app = _createApp(comp)
  const mount = app.mount
  app.mount = (container, ...args: any[]) => {
    container = normalizeContainer(container) as ParentNode
    return mount(container, ...args)
  }
  return app
}
