import { createRenderer, Component } from '@vue/runtime-core'
import { nodeOps } from './nodeOps'
import { patchData } from './patchData'

const { render: _render } = createRenderer({
  nodeOps,
  patchData
})

type publicRender = (
  node: {} | null,
  container: HTMLElement
) => Promise<Component | null>
export const render = _render as publicRender

// re-export everything from core
// h, Component, observer API, nextTick, flags & types
export * from '@vue/runtime-core'
