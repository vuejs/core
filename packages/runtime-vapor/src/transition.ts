import { getComponentName } from '@vue/runtime-dom'
import type { Block } from './block'
import type { VaporTransitionHooks } from './block'
import type { VaporComponent } from './component'

// Transition hooks registry for tree-shaking
// These are registered by Transition component when it's used
type ApplyTransitionHooksFn = (
  block: Block,
  hooks: VaporTransitionHooks,
) => VaporTransitionHooks
type ApplyTransitionLeaveHooksFn = (
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
) => void

export let applyTransitionHooks: ApplyTransitionHooksFn
export let applyTransitionLeaveHooks: ApplyTransitionLeaveHooksFn

export let isTransitionEnabled = false

export function registerTransitionHooks(
  applyHooks: ApplyTransitionHooksFn,
  applyLeaveHooks: ApplyTransitionLeaveHooksFn,
): void {
  isTransitionEnabled = true
  applyTransitionHooks = applyHooks
  applyTransitionLeaveHooks = applyLeaveHooks
}

export const displayName = 'VaporTransition'

export function isVaporTransition(component: VaporComponent): boolean {
  return getComponentName(component) === displayName
}
