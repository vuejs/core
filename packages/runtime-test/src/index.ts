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

export const render: RootRenderFunction<TestElement> = baseRender
export const createApp: CreateAppFunction<TestElement> = baseCreateApp

// convenience for one-off render validations
export function renderToString(vnode: VNode): string {
  const root = nodeOps.createElement('div')
  render(vnode, root)
  return serializeInner(root)
}

export * from './triggerEvent'
export * from './serialize'
export * from './nodeOps'
export * from '@vue/runtime-core'
