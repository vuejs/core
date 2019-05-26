import { createRenderer, VNode } from '@vue/runtime-core'
import { DOMRendererOptions } from './rendererOptions'

export const render = createRenderer(DOMRendererOptions) as (
  vnode: VNode | null,
  container: HTMLElement
) => VNode

// re-export everything from core
// h, Component, observer API, nextTick, flags & types
export * from '@vue/runtime-core'
