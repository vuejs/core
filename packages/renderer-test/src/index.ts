import { createRenderer, VNode } from '@vue/core'
import { nodeOps, TestElement } from './nodeOps'

function patchData(
  el: TestElement,
  key: string,
  prevValue: any,
  nextValue: any
) {
  el.props[key] = nextValue
}

const { render: _render } = createRenderer({
  nodeOps,
  patchData
})

type publicRender = (node: VNode | null, container: TestElement) => void
export const render = _render as publicRender

export * from './nodeOps'
export * from '@vue/core'
