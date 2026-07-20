import type { VNode } from '@vue/runtime-dom'
import type { Block, BlockFn } from './block'
import type { VaporTransitionHooks } from './block'
import type { FunctionalVaporComponent, VaporComponent } from './component'
import type { DynamicFragment } from './fragment'

// Transition hooks registry for tree-shaking
// These are registered by Transition component when it's used
type ApplyTransitionHooksFn = (
  block: Block,
  hooks: VaporTransitionHooks,
) => VaporTransitionHooks
type DeferBranchUpdateDuringLeaveFn = (
  frag: DynamicFragment,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
) => boolean
type RemoveBranchWithLeaveFn = (
  frag: DynamicFragment,
  transition: VaporTransitionHooks,
  parent: ParentNode | null,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
) => boolean

export let applyTransitionHooks: ApplyTransitionHooksFn
// Branch-switch scheduling for DynamicFragment.update(): defer the incoming
// branch while a leave is in progress, and apply leave hooks (plus the
// deferred re-render for out-in) when tearing down the outgoing branch.
export let deferBranchUpdateDuringLeave: DeferBranchUpdateDuringLeaveFn
export let removeBranchWithLeave: RemoveBranchWithLeaveFn

type GetInteropTransitionTypeFn = (vnode: VNode) => VNode['type'] | undefined
type GetInteropTransitionElementFn = (vnode: VNode) => Element | undefined

export let getInteropTransitionType: GetInteropTransitionTypeFn
export let getInteropTransitionElement: GetInteropTransitionElementFn

export let isTransitionEnabled = false

export function registerTransitionHooks(
  applyHooks: ApplyTransitionHooksFn,
  deferBranchUpdate: DeferBranchUpdateDuringLeaveFn,
  removeBranch: RemoveBranchWithLeaveFn,
): void {
  isTransitionEnabled = true
  applyTransitionHooks = applyHooks
  deferBranchUpdateDuringLeave = deferBranchUpdate
  removeBranchWithLeave = removeBranch
}

export function registerTransitionInterop(
  getType: GetInteropTransitionTypeFn,
  getElement: GetInteropTransitionElementFn,
): void {
  getInteropTransitionType = getType
  getInteropTransitionElement = getElement
}

export const displayName = 'VaporTransition'

export function isVaporTransition(component: VaporComponent): boolean {
  return (component as FunctionalVaporComponent).displayName === displayName
}
