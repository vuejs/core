import {
  h,
  createRenderer,
  Component,
  createComponentInstance
} from '@vue/runtime-core'
import { nodeOps, TestElement } from './nodeOps'
import { patchData } from './patchData'

const { render: _render } = createRenderer({
  nodeOps,
  patchData
})

type publicRender = (
  node: {} | null,
  container: TestElement
) => Component | null
export const render = _render as publicRender

export function createInstance<T extends Component>(
  Class: new () => T,
  props?: any
): T {
  return createComponentInstance(h(Class, props)).$proxy as any
}

export function renderIntsance<T extends Component>(
  Class: new () => T,
  props?: any
): T {
  return render(h(Class, props), nodeOps.createElement('div')) as any
}

export { serialize } from './serialize'
export { triggerEvent } from './triggerEvent'
export * from './nodeOps'
export * from '@vue/runtime-core'
