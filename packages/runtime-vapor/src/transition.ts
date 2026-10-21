import type { TransitionHooks } from '@vue/runtime-dom'
import type { Block, BlockFn } from './block'
import type { VaporTransitionHooks } from './block'
import type { FunctionalVaporComponent, VaporComponent } from './component'
import type { DynamicFragment, VaporFragment } from './fragment'
import type { SlotResolutionState } from './slotFragment'

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
  unpaired?: boolean,
) => boolean
type DeferBranchUpdateDuringLeaveFn = (
  frag: DynamicFragment,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
  branchKey: any,
  prevKey: any,
) => boolean
type RemoveBranchWithLeaveFn = (
  frag: DynamicFragment,
  transition: VaporTransitionHooks,
  parent: ParentNode,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
  branchKey: any,
) => boolean
// A slot fallback committed under out-in: `cb` follows the leave a root of
// the content is still running on its own (to nothing), if any, when the
// fallback has a child to animate for it
type AwaitLeavingRootFn = (
  fallback: Block,
  state: SlotResolutionState,
  cb: () => void,
) => boolean
type ResolveOutletLeaveFn = (
  outlet: VaporFragment | undefined,
  block: Block,
  hooks: TransitionHooks,
) => boolean

export let applyTransitionHooks: ApplyTransitionHooksFn
export let applyTransitionLeaveHooks: ApplyTransitionLeaveHooksFn
export let awaitLeavingRoot: AwaitLeavingRootFn
// Branch-switch scheduling for DynamicFragment.update(): defer the incoming
// branch while a leave is in progress, and apply leave hooks (plus the
// deferred re-render for out-in) when tearing down the outgoing branch.
export let deferBranchUpdateDuringLeave: DeferBranchUpdateDuringLeaveFn
export let removeBranchWithLeave: RemoveBranchWithLeaveFn
// whether `hooks` carry a mode of the block's own to apply: vapor hooks not
// inherited across a child component, where only the enter / leave hooks reach
export let ownsTransitionMode: (
  hooks: TransitionHooks,
  frag?: VaporFragment,
) => boolean
// A slot outlet switching branches: whether the switch is persisted, i.e. a
// v-show target above the outlet (or `persisted`); the branch leaving it
// leaves structurally otherwise
export let resolveOutletLeave: ResolveOutletLeaveFn

export let isTransitionEnabled = false

export function registerTransitionHooks(
  applyHooks: ApplyTransitionHooksFn,
  applyLeaveHooks: ApplyTransitionLeaveHooksFn,
  deferBranchUpdate: DeferBranchUpdateDuringLeaveFn,
  removeBranch: RemoveBranchWithLeaveFn,
  ownsMode: (hooks: TransitionHooks, frag?: VaporFragment) => boolean,
  awaitLeaving: AwaitLeavingRootFn,
  resolveLeave: ResolveOutletLeaveFn,
): void {
  isTransitionEnabled = true
  ownsTransitionMode = ownsMode
  applyTransitionHooks = applyHooks
  applyTransitionLeaveHooks = applyLeaveHooks
  deferBranchUpdateDuringLeave = deferBranchUpdate
  removeBranchWithLeave = removeBranch
  awaitLeavingRoot = awaitLeaving
  resolveOutletLeave = resolveLeave
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
