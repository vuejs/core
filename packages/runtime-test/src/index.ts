import { createRenderer, VNode } from '@vue/runtime-core'
import { nodeOps, TestElement } from './nodeOps'
import { patchProp } from './patchProp'

export const render = createRenderer({
  patchProp,
  ...nodeOps
}) as (node: VNode | null, container: TestElement) => VNode

export { serialize } from './serialize'
export { triggerEvent } from './triggerEvent'
export * from './nodeOps'
export * from '@vue/runtime-core'
