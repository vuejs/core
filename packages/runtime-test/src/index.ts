import { createRenderer, VNode } from '@vue/runtime-core'
import { nodeOps, TestElement } from './nodeOps'
import { patchProp } from './patchProp'
import { serializeInner } from './serialize'

export const render = createRenderer({
  patchProp,
  ...nodeOps
}) as (node: VNode | null, container: TestElement) => VNode

// convenience for one-off render validations
export function renderToString(vnode: VNode) {
  const root = nodeOps.createElement('div')
  render(vnode, root)
  return serializeInner(root)
}

export * from './triggerEvent'
export * from './serialize'
export * from './nodeOps'
export * from './jestUtils'
export * from '@vue/runtime-core'
