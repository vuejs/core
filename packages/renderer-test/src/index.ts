import { createRenderer, VNode } from '@vue/core'
import { nodeOps, TestElement } from './nodeOps'
import { patchData } from './patchData'

const { render: _render } = createRenderer({
  nodeOps,
  patchData
})

type publicRender = (node: VNode | null, container: TestElement) => void
export const render = _render as publicRender

export * from './nodeOps'
export * from '@vue/core'
