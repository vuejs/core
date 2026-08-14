import { isArray, isString } from '@vue/shared'
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
import { getScopeOwner } from './componentSlots'
import {
  isHydrating,
  isRecreatedNode,
  runWithoutHydration,
} from './dom/hydration'
import { isTeleportEnabled, isTeleportFragment } from './teleport'

export type ScopeIdValue = string | readonly string[] | null | undefined

function mergeScopeId(
  scopeIds: ScopeIdValue,
  scopeId: string,
  owned?: boolean,
): ScopeIdValue {
  if (!scopeIds) return scopeId
  if (isString(scopeIds)) {
    return scopeIds === scopeId ? scopeIds : [scopeIds, scopeId]
  }
  if (scopeIds.includes(scopeId)) return scopeIds
  if (owned) {
    ;(scopeIds as string[]).push(scopeId)
    return scopeIds
  }
  const merged = scopeIds.slice()
  merged.push(scopeId)
  return merged
}

export function mergeScopeIds(
  current: ScopeIdValue,
  incoming: ScopeIdValue,
  owned: boolean = false,
): ScopeIdValue {
  if (!incoming || incoming.length === 0) return current
  if (!current) return incoming
  if (isString(incoming)) {
    return mergeScopeId(current, incoming, owned)
  }
  let merged: ScopeIdValue = current
  for (let i = 0; i < incoming.length; i++) {
    // once merged diverges from current it is a locally created array,
    // so further ids can be pushed in place instead of copied per id
    merged = mergeScopeId(merged, incoming[i], owned || merged !== current)
  }
  return merged
}

function isSameScopeIds(a: ScopeIdValue, b: ScopeIdValue): boolean {
  if (a === b) return true
  if (!isArray(a) || !isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// An empty dynamic fragment still occupies the component's single-root slot,
// so a future branch can inherit its scope IDs.
const EMPTY_DYNAMIC_ROOT = true
type ScopeIdRoot =
  | Element
  | VaporComponentInstance
  | InteropFragment
  | typeof EMPTY_DYNAMIC_ROOT

function applyFragmentScopeIds(this: VaporFragment, block: Block): void {
  const componentRoot = this.scopeIdRoot
  if (componentRoot) {
    applySingleRootScopeId(componentRoot.block, componentRoot)
  }
  if (this.slottedScopeId) {
    applySlottedScopeId(block, this.slottedScopeId)
  }
}

function registerFragmentComponentScopeId(
  fragment: VaporFragment,
  instance: VaporComponentInstance,
): void {
  fragment.scopeIdRoot = instance
  fragment.applyScopeId = applyFragmentScopeIds
}

function applyInteropScopeIds(this: InteropFragment, block: Block): void {
  if (this.vnode) {
    syncInteropFragmentScopeIds(this)
  } else {
    applyFragmentScopeIds.call(this, block)
  }
}

function resolveSingleScopeIdRoot(
  block: Block,
  onFragment?: (
    fragment: VaporFragment,
    instance: VaporComponentInstance,
  ) => void,
  instance?: VaporComponentInstance,
): ScopeIdRoot | undefined {
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
      return root || EMPTY_DYNAMIC_ROOT
    }
    return root
  }

  if (isArray(block)) {
    let root: ScopeIdRoot | undefined
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
    resolveSingleScopeIdRoot(parent.block) !== instance
  ) {
    return
  }
  return parent
}

function applyInteropFragmentScopeIds(
  fragment: InteropFragment,
  instance: VaporComponentInstance,
): void {
  fragment.scopeIdRoot = instance
  fragment.applyScopeId = applyInteropScopeIds
  syncInteropFragmentScopeIds(fragment)
  if (!fragment.vnode) {
    applySingleRootScopeId(fragment.nodes, instance)
  }
}

function mergeInstanceScopeIds(
  scopeIds: ScopeIdValue,
  instance: VaporComponentInstance,
): ScopeIdValue {
  let owned = false
  let current: VaporComponentInstance | undefined = instance
  while (current) {
    const previous = scopeIds
    scopeIds = mergeScopeIds(scopeIds, current.scopeId, owned)
    if (previous && scopeIds !== previous) owned = true
    current = getScopeIdParent(current)
  }
  return scopeIds
}

function syncInteropFragmentScopeIds(fragment: InteropFragment): void {
  const vnode = fragment.vnode
  if (!vnode) return
  if (fragment.scopeIdVNode !== vnode) {
    fragment.scopeIdVNode = vnode
    fragment.scopeIdBase = vnode.slotScopeIds
  }

  let scopeIds = mergeScopeIds(fragment.scopeIdBase, fragment.slottedScopeId)
  const componentRoot = fragment.scopeIdRoot
  if (componentRoot) {
    scopeIds = mergeInstanceScopeIds(scopeIds, componentRoot)
  }
  const existing = vnode.slotScopeIds
  if (isString(scopeIds)) {
    if (!existing || existing.length !== 1 || existing[0] !== scopeIds) {
      vnode.slotScopeIds = [scopeIds]
    }
  } else if (!scopeIds) {
    if (existing) vnode.slotScopeIds = null
  } else if (!isSameScopeIds(existing, scopeIds)) {
    vnode.slotScopeIds = scopeIds.slice()
  }
}

function applyFlatScopeIds(element: Element, scopeIds: ScopeIdValue): void {
  if (!scopeIds) return
  // Adopted SSR elements already carry their scope attrs; only nodes recreated
  // by a hydration mismatch still need the client-side writes.
  if (isHydrating) {
    if (isRecreatedNode(element)) {
      runWithoutHydration(() => applyFlatScopeIds(element, scopeIds))
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

export function applySlottedScopeId(
  block: Block,
  scopeIds: ScopeIdValue,
): void {
  if (!scopeIds) return
  if (block instanceof Element) {
    applyFlatScopeIds(block, scopeIds)
  } else if (isVaporComponent(block)) {
    const merged = mergeScopeIds(block.scopeId, scopeIds)
    if (merged === block.scopeId) return
    block.scopeId = merged
    if (block.isMounted) {
      applySingleRootScopeId(block.block, block)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      applySlottedScopeId(block[i], scopeIds)
    }
  } else if (isFragment(block)) {
    const merged = mergeScopeIds(block.slottedScopeId, scopeIds)
    if (merged === block.slottedScopeId) return
    block.slottedScopeId = merged
    if (isInteropEnabled && isInteropFragment(block)) {
      block.applyScopeId = applyInteropScopeIds
      syncInteropFragmentScopeIds(block)
      return
    }
    block.applyScopeId = applyFragmentScopeIds
    applySlottedScopeId(block.nodes, scopeIds)
  }
}

function applyInstanceScopeIds(
  element: Element,
  instance: VaporComponentInstance,
): void {
  // Same guard as applyFlatScopeIds, hoisted so adopted SSR elements also
  // skip the parent-chain walk.
  if (isHydrating) {
    if (isRecreatedNode(element)) {
      runWithoutHydration(() => applyInstanceScopeIds(element, instance))
    }
    return
  }
  let current: VaporComponentInstance | undefined = instance
  while (current) {
    applyFlatScopeIds(element, current.scopeId)
    current = getScopeIdParent(current)
  }
}

function applySingleRootScopeId(
  block: Block,
  instance: VaporComponentInstance,
): void {
  const root = resolveSingleScopeIdRoot(block)
  if (!root) return
  if (isArray(block) || isFragment(block)) {
    resolveSingleScopeIdRoot(block, registerFragmentComponentScopeId, instance)
  }
  if (root === EMPTY_DYNAMIC_ROOT) {
    return
  }
  if (root instanceof Element) {
    applyInstanceScopeIds(root, instance)
  } else if (isVaporComponent(root)) {
    root.inheritsScopeId = true
    if (root.isMounted) {
      applySingleRootScopeId(root.block, root)
    }
  } else if (isInteropEnabled) {
    applyInteropFragmentScopeIds(root, instance)
  }
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
  applySingleRootScopeId(instance.block, instance)
}

export function setComponentScopeId(
  instance: VaporComponentInstance,
  scopeIds: ScopeIdValue,
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
  if (!root || root === EMPTY_DYNAMIC_ROOT || root instanceof Element) return
  root.scopeIdRoot = componentRoot
  root.applyScopeId = applyInteropScopeIds
  syncInteropFragmentScopeIds(root)
}

export function getCurrentScopeId(): string | undefined {
  const scopeOwner = getScopeOwner()
  return scopeOwner ? scopeOwner.type.__scopeId : undefined
}
