import { createRenderer, VNode } from '@vue/core'
import { queueJob, nextTick } from '@vue/scheduler'

import { nodeOps } from './nodeOps'
import { patchData } from './patchData'
import { teardownVNode } from './teardownVNode'

const { render: _render } = createRenderer({
  scheduler: {
    queueJob,
    nextTick
  },
  nodeOps,
  patchData,
  teardownVNode
})

type publicRender = (node: VNode | null, container: HTMLElement) => void
export const render = _render as publicRender

// nextTick from scheduler
export { nextTick } from '@vue/scheduler'

// re-export everything from core
// h, Component, observer API, flags & types
export * from '@vue/core'
