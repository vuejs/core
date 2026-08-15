import { isArray, isString } from '@vue/shared'
import { currentInstance } from '@vue/runtime-dom'
import { type VaporComponentInstance, isVaporComponent } from './component'
import {
  type InteropFragment,
  type VaporFragment,
  isDynamicFragment,
  isFragment,
  isInteropFragment,
} from './fragment'
import type { Block } from './block'
import { isInteropEnabled } from './vdomInteropState'
import { currentSlotOwner, getScopeOwner } from './componentSlots'
import {
  isHydrating,
  isRecreatedNode,
  runWithoutHydration,
} from './dom/hydration'
import { isTeleportEnabled, isTeleportFragment } from './teleport'

export type ScopeId = string | readonly string[] | null | undefined

function mergeScopeId(
  scopeIds: ScopeId,
  scopeId: string,
  canMutate: boolean,
): ScopeId {
  if (!scopeIds) return scopeId
  if (isString(scopeIds)) {
    return scopeIds === scopeId ? scopeIds : [scopeIds, scopeId]
  }
  if (scopeIds.includes(scopeId)) return scopeIds
  if (canMutate) {
    ;(scopeIds as string[]).push(scopeId)
    return scopeIds
  }
  const merged = scopeIds.slice()
  merged.push(scopeId)
  return merged
}

function mergeScopeIdsInternal(
  current: ScopeId,
  incoming: ScopeId,
  canMutate: boolean,
): ScopeId {
  if (!incoming || incoming.length === 0) return current
  if (!current) return incoming
  if (isString(incoming)) {
    return mergeScopeId(current, incoming, canMutate)
  }
  let merged: ScopeId = current
  for (let i = 0; i < incoming.length; i++) {
    // once merged diverges from current it is a locally created array,
    // so further ids can be pushed in place instead of copied per id
    merged = mergeScopeId(merged, incoming[i], canMutate || merged !== current)
  }
  return merged
}

export function mergeScopeIds(current: ScopeId, incoming: ScopeId): ScopeId {
  return mergeScopeIdsInternal(current, incoming, false)
}

export function isSameScopeIds(a: ScopeId, b: ScopeId): boolean {
  if (a === b) return true
  if (!isArray(a) || !isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// A dynamic fragment without a current scope root still occupies the
// component's single-root slot, so a future branch can inherit its scope IDs.
const DYNAMIC_ROOT_PLACEHOLDER = true
type ScopeIdRootCandidate =
  | Element
  | VaporComponentInstance
  | InteropFragment
  | typeof DYNAMIC_ROOT_PLACEHOLDER

function applyFragmentScopeId(this: VaporFragment, block: Block): void {
  if (isInteropEnabled && isInteropFragment(this) && this.vnode) {
    this.syncScopeId()
    return
  }
  const owner = this.scopeOwner
  if (owner) {
    applyRootScopeId(owner.block, owner)
  }
  if (this.slottedScopeId) {
    applySlottedScopeId(block, this.slottedScopeId)
  }
}

function bindFragmentScopeIdOwner(
  fragment: VaporFragment,
  instance: VaporComponentInstance,
): void {
  fragment.scopeOwner = instance
  fragment.applyScopeId = applyFragmentScopeId
}

function resolveSingleScopeIdRoot(
  block: Block,
  onFragment?: (
    fragment: VaporFragment,
    instance: VaporComponentInstance,
  ) => void,
  instance?: VaporComponentInstance,
): ScopeIdRootCandidate | undefined {
  if (block instanceof Element) {
    return block
  }

  if (isVaporComponent(block)) {
    return block
  }

  if (isFragment(block)) {
    if (isTeleportEnabled && isTeleportFragment(block)) {
      return
    }
    if (isInteropEnabled && isInteropFragment(block)) {
      return block
    }
    const root = resolveSingleScopeIdRoot(block.nodes, onFragment, instance)
    if (isDynamicFragment(block)) {
      if (onFragment) onFragment(block, instance!)
      return root || DYNAMIC_ROOT_PLACEHOLDER
    }
    return root
  }

  if (isArray(block)) {
    let root: ScopeIdRootCandidate | undefined
    let hasComment = false
    for (let i = 0; i < block.length; i++) {
      const child = block[i]
      if (child instanceof Comment) {
        hasComment = true
        continue
      }
      const childRoot = resolveSingleScopeIdRoot(child, onFragment, instance)
      if (!childRoot || root) {
        return
      }
      root = childRoot
    }
    return hasComment ? root : undefined
  }
}

function getScopeIdParent(
  instance: VaporComponentInstance,
): VaporComponentInstance | undefined {
  if (!instance.inheritsScopeId) return
  const parent = instance.parent
  if (
    !parent ||
    !isVaporComponent(parent) ||
    // parent.block is unassigned while the parent is still setting up (e.g.
    // hydration-mismatch writes fired from a creation site). Until it exists,
    // trust the creation-time inheritsScopeId flag (set through
    // getHydratingScopeIdOwner) in place of the structural check.
    (parent.block && resolveSingleScopeIdRoot(parent.block) !== instance)
  ) {
    return
  }
  return parent
}

function applyInteropFragmentScopeIds(
  fragment: InteropFragment,
  instance: VaporComponentInstance,
): void {
  bindFragmentScopeIdOwner(fragment, instance)
  if (fragment.vnode) {
    fragment.syncScopeId()
  }
  // Keep the owner for later vnode-backed resolution, but do not descend
  // root-only ids into a slot host's current vapor content or fallback.
}

export function mergeComponentScopeIds(
  scopeIds: ScopeId,
  instance: VaporComponentInstance,
): ScopeId {
  let canMutate = false
  let current: VaporComponentInstance | undefined = instance
  while (current) {
    const previous = scopeIds
    scopeIds = mergeScopeIdsInternal(scopeIds, current.scopeId, canMutate)
    if (previous && scopeIds !== previous) canMutate = true
    current = getScopeIdParent(current)
  }
  return scopeIds
}

function setElementScopeId(element: Element, scopeIds: ScopeId): void {
  if (!scopeIds) return
  // Adopted SSR elements already carry their scope attrs; only nodes recreated
  // by a hydration mismatch still need the client-side writes.
  if (isHydrating) {
    if (isRecreatedNode(element)) {
      runWithoutHydration(() => setElementScopeId(element, scopeIds))
    }
    return
  }
  if (isString(scopeIds)) {
    element.setAttribute(scopeIds, '')
    return
  }
  for (let i = 0; i < scopeIds.length; i++) {
    element.setAttribute(scopeIds[i], '')
  }
}

export function applySlottedScopeId(block: Block, scopeIds: ScopeId): void {
  if (!scopeIds) return
  if (block instanceof Element) {
    setElementScopeId(block, scopeIds)
  } else if (isVaporComponent(block)) {
    const merged = mergeScopeIds(block.scopeId, scopeIds)
    if (merged === block.scopeId) return
    block.scopeId = merged
    if (block.isMounted) {
      applyRootScopeId(block.block, block)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      applySlottedScopeId(block[i], scopeIds)
    }
  } else if (isFragment(block)) {
    const merged = mergeScopeIds(block.slottedScopeId, scopeIds)
    if (merged === block.slottedScopeId) return
    block.slottedScopeId = merged
    block.applyScopeId = applyFragmentScopeId
    if (isInteropEnabled && isInteropFragment(block)) {
      if (block.vnode) block.syncScopeId()
    } else {
      applySlottedScopeId(block.nodes, scopeIds)
    }
  }
}

function setComponentRootScopeId(
  element: Element,
  instance: VaporComponentInstance,
): void {
  // Same guard as setElementScopeId, hoisted so adopted SSR elements also
  // skip the parent-chain walk.
  if (isHydrating) {
    if (isRecreatedNode(element)) {
      runWithoutHydration(() => setComponentRootScopeId(element, instance))
    }
    return
  }
  let current: VaporComponentInstance | undefined = instance
  while (current) {
    setElementScopeId(element, current.scopeId)
    current = getScopeIdParent(current)
  }
}

function applyRootScopeId(
  block: Block,
  instance: VaporComponentInstance,
): void {
  const root =
    block instanceof Element ? block : resolveSingleScopeIdRoot(block)
  if (!root) return
  if (isArray(block) || isFragment(block)) {
    resolveSingleScopeIdRoot(block, bindFragmentScopeIdOwner, instance)
  }
  if (root === DYNAMIC_ROOT_PLACEHOLDER) {
    return
  }
  if (root instanceof Element) {
    setComponentRootScopeId(root, instance)
  } else if (isVaporComponent(root)) {
    root.inheritsScopeId = true
    if (root.isMounted) {
      applyRootScopeId(root.block, root)
    }
  } else if (isInteropEnabled) {
    applyInteropFragmentScopeIds(root, instance)
  }
}

/**
 * Resolves the instance whose scope ids a hydrating single root inherits:
 * the current instance, unless slot content or a non-vapor parent owns the
 * creation site or the instance carries no ids to inherit.
 */
export function getHydratingScopeIdOwner(
  isSingleRoot: boolean | undefined,
): VaporComponentInstance | undefined {
  if (
    isSingleRoot &&
    !currentSlotOwner &&
    isVaporComponent(currentInstance) &&
    (currentInstance.scopeId || currentInstance.inheritsScopeId)
  ) {
    return currentInstance
  }
}

/**
 * During hydration a component's root fragment hydrates before mountComponent
 * gets to run applyComponentRootScopeId, so nodes recreated by a hydration
 * mismatch would miss their scope attributes. Creation sites producing a
 * component's single root wire the owner up front through this helper before
 * the fragment hydrates.
 */
export function applyHydratingRootScopeId(
  isSingleRoot: boolean | undefined,
  block: Block,
): void {
  const owner = getHydratingScopeIdOwner(isSingleRoot)
  if (owner) applyRootScopeId(block, owner)
}

export function applyComponentRootScopeId(
  instance: VaporComponentInstance,
): void {
  // rawPropsRef doubles as the VDOM-created-instance marker: interop
  // contributions can go from empty to non-empty on a later vnode update, so
  // such instances must pre-register their root wiring even with no ids yet.
  if (!instance.scopeId && !instance.inheritsScopeId && !instance.rawPropsRef) {
    return
  }
  applyRootScopeId(instance.block, instance)
}

export function setInteropComponentScopeId(
  instance: VaporComponentInstance,
  scopeIds: ScopeId,
): void {
  if (isSameScopeIds(instance.scopeId, scopeIds)) return
  instance.scopeId = scopeIds
  if (!instance.isMounted) return

  let componentRoot = instance
  let root = resolveSingleScopeIdRoot(instance.block)
  while (root && isVaporComponent(root)) {
    componentRoot = root
    root = resolveSingleScopeIdRoot(root.block)
  }
  if (!root || root === DYNAMIC_ROOT_PLACEHOLDER || root instanceof Element) {
    return
  }
  bindFragmentScopeIdOwner(root, componentRoot)
  root.syncScopeId()
}

export function getCurrentScopeId(): string | undefined {
  const scopeOwner = getScopeOwner()
  return isVaporComponent(scopeOwner) ? scopeOwner.type.__scopeId : undefined
}
