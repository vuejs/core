import type { TransitionHooks } from '@vue/runtime-dom'
import type { Block, BlockFn } from './block'
import type { VaporTransitionHooks } from './block'
import type { FunctionalVaporComponent, VaporComponent } from './component'
import type { DynamicFragment, VaporFragment } from './fragment'

// Transition hooks registry for tree-shaking
// These are registered by Transition component when it's used
type ApplyTransitionHooksFn = (
  block: Block,
  hooks: VaporTransitionHooks,
  // the fragment whose content `block` is; resolves the key context the
  // content sits in
  owner?: VaporFragment,
) => VaporTransitionHooks
type ApplyTransitionLeaveHooksFn = (
  block: Block,
  hooks: VaporTransitionHooks,
  afterLeave: () => void,
) => boolean
type DeferBranchUpdateDuringLeaveFn = (
  frag: DynamicFragment,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
  branchKey: any,
) => boolean
type RemoveBranchWithLeaveFn = (
  frag: DynamicFragment,
  transition: VaporTransitionHooks,
  parent: ParentNode | null,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
  branchKey: any,
) => boolean

export let applyTransitionHooks: ApplyTransitionHooksFn
export let applyTransitionLeaveHooks: ApplyTransitionLeaveHooksFn
// Branch-switch scheduling for DynamicFragment.update(): defer the incoming
// branch while a leave is in progress, and apply leave hooks (plus the
// deferred re-render for out-in) when tearing down the outgoing branch.
export let deferBranchUpdateDuringLeave: DeferBranchUpdateDuringLeaveFn
export let removeBranchWithLeave: RemoveBranchWithLeaveFn

export let isTransitionEnabled = false

export function registerTransitionHooks(
  applyHooks: ApplyTransitionHooksFn,
  applyLeaveHooks: ApplyTransitionLeaveHooksFn,
  deferBranchUpdate: DeferBranchUpdateDuringLeaveFn,
  removeBranch: RemoveBranchWithLeaveFn,
): void {
  isTransitionEnabled = true
  applyTransitionHooks = applyHooks
  applyTransitionLeaveHooks = applyLeaveHooks
  deferBranchUpdateDuringLeave = deferBranchUpdate
  removeBranchWithLeave = removeBranch
}

// Hooks vapor resolves from (its own, or a vdom Transition's for a vapor slot,
// shaped as a VaporTransition root's). A vdom Transition's hooks relayed to a
// vapor component child are not: they belong to vdom's state machine.
export function isVaporTransitionHooks(
  hooks: TransitionHooks | null | undefined,
): hooks is VaporTransitionHooks {
  return !!hooks && (hooks as VaporTransitionHooks).__vapor === true
}

export const displayName = 'VaporTransition'

export function isVaporTransition(component: VaporComponent): boolean {
  return (component as FunctionalVaporComponent).displayName === displayName
}
