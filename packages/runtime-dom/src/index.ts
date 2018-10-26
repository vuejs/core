import { createRenderer, VNode, Component } from '@vue/runtime-core'
import { nodeOps } from './nodeOps'
import { patchData } from './patchData'
import { teardownVNode } from './teardownVNode'

const { render: _render } = createRenderer({
  nodeOps,
  patchData,
  teardownVNode
})

type publicRender = (
  node: VNode | null,
  container: HTMLElement
) => Component | null
export const render = _render as publicRender

// re-export everything from core
// h, Component, observer API, nextTick, flags & types
export * from '@vue/runtime-core'
