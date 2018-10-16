import { createRenderer, VNode, Component } from '@vue/core'
import { nodeOps, TestElement } from './nodeOps'
import { patchData } from './patchData'

const { render: _render } = createRenderer({
  nodeOps,
  patchData
})

type publicRender = (
  node: VNode | null,
  container: TestElement
) => Component | null
export const render = _render as publicRender

export { serialize } from './serialize'
export * from './nodeOps'
export * from '@vue/core'
