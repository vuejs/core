import type { Block } from './block'
import type { VaporTransitionHooks } from './block'

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

let _applyTransitionHooks: ApplyTransitionHooksFn | undefined
let _applyTransitionLeaveHooks: ApplyTransitionLeaveHooksFn | undefined

export function registerTransitionHooks(
  applyHooks: ApplyTransitionHooksFn,
  applyLeaveHooks: ApplyTransitionLeaveHooksFn,
): void {
  _applyTransitionHooks = applyHooks
  _applyTransitionLeaveHooks = applyLeaveHooks
}

export function applyTransitionHooks(
  block: Block,
  hooks: VaporTransitionHooks,
): VaporTransitionHooks {
  return _applyTransitionHooks ? _applyTransitionHooks(block, hooks) : hooks
}

export function applyTransitionLeaveHooks(
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
): void {
  _applyTransitionLeaveHooks &&
    _applyTransitionLeaveHooks(block, enterHooks, afterLeaveCb)
}
