import {
  type CreateAppFunction,
  type RootRenderFunction,
  type VNode,
  createRenderer,
} from '@vue/runtime-core'
import { type TestElement, nodeOps } from './nodeOps'
import { patchProp } from './patchProp'
import { serializeInner } from './serialize'
import { extend } from '@vue/shared'

const { render: baseRender, createApp: baseCreateApp } = createRenderer(
  extend({ patchProp }, nodeOps),
)

export const render = baseRender as RootRenderFunction<TestElement>
export const createApp = baseCreateApp as CreateAppFunction<TestElement>

// convenience for one-off render validations
export function renderToString(vnode: VNode) {
  const root = nodeOps.createElement('div')
  render(vnode, root)
  return serializeInner(root)
}

export * from './triggerEvent'
export * from './serialize'
export * from './nodeOps'
export * from '@vue/runtime-core'
