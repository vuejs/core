import { normalizeContainer } from './_old/apiRender'
import { insert } from './dom/element'
import { type VaporComponent, createComponent } from './component'
import {
  type AppMountFn,
  type AppUnmountFn,
  type CreateAppFunction,
  createAppAPI,
} from '@vue/runtime-core'

let _createApp: CreateAppFunction<ParentNode, VaporComponent>

const mountApp: AppMountFn<ParentNode> = (app, container) => {
  // clear content before mounting
  if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
    container.textContent = ''
  }
  const instance = createComponent(app._component)
  insert(instance.block, container)
  return instance
}

const unmountApp: AppUnmountFn = app => {
  // TODO
}

export const createVaporApp: CreateAppFunction<
  ParentNode,
  VaporComponent
> = comp => {
  if (!_createApp) _createApp = createAppAPI(mountApp, unmountApp)
  const app = _createApp(comp)
  const mount = app.mount
  app.mount = (container, ...args: any[]) => {
    container = normalizeContainer(container) // TODO reuse from runtime-dom
    return mount(container, ...args)
  }
  return app
}
