import { EffectScope } from '@vue/reactivity'

import { Block, BlockFn } from './render'

export interface ComponentInternalInstance {
  uid: number
  container: ParentNode
  block: Block | null
  scope: EffectScope

  component: BlockFn
  isMounted: boolean

  // TODO: registory of provides, appContext, lifecycles, ...
}

let uid = 0
export const createComponentInstance = (
  component: BlockFn,
): ComponentInternalInstance => {
  const instance: ComponentInternalInstance = {
    uid: uid++,
    block: null,
    container: null!, // set on mount
    scope: new EffectScope(true /* detached */)!,

    component,
    isMounted: false,
    // TODO: registory of provides, appContext, lifecycles, ...
  }
  return instance
}

// FIXME: duplicated with runtime-core
export type Data = Record<string, unknown>
