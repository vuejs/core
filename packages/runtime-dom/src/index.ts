import { createRenderer, VNode, createAppAPI } from '@vue/runtime-core'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'

export const render = createRenderer({
  patchProp,
  ...nodeOps
}) as (vnode: VNode | null, container: HTMLElement) => void

export const createApp = createAppAPI(render)

// re-export everything from core
// h, Component, reactivity API, nextTick, flags & types
export * from '@vue/runtime-core'
