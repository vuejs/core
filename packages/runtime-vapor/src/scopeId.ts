import { ShapeFlags, isArray, isString } from '@vue/shared'
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
import { FOR_ITEM, SLOT } from './fragmentFlags'
import { isInteropEnabled } from './vdomInteropState'
import {
  type SlottedScopeIdSource,
  currentSlotOwner,
  getScopeOwner,
} from './componentSlots'
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

function applyFragmentRootScopeId(this: VaporFragment): true | undefined {
  if (isInteropEnabled && isInteropFragment(this) && this.vnode) {
    this.syncScopeId()
    return true
  }
  const owner = this.scopeOwner
  if (owner) {
    applyRootScopeId(owner.block, owner)
  }
}

function applyFragmentScopeId(this: VaporFragment, block: Block): void {
  if (applyFragmentRootScopeId.call(this)) return
  const scopeIds = this.slottedScopeId
  if (scopeIds) {
    applySlottedScopeId(block, scopeIds)
  }
  const source = this.slottedScopeIdSource
  if (source) {
    applyCurrentSlottedScopeId(block, getSlottedScopeId(source))
  }
}

export function getSlottedScopeId(
  source: SlottedScopeIdSource,
): readonly string[] | null {
  const parent = source.parent
  return mergeScopeIds(
    parent ? getSlottedScopeId(parent) : null,
    source.value,
  ) as readonly string[] | null
}

export function createSlottedScopeIdSource(
  value: ScopeId,
  parent: SlottedScopeIdSource | null,
): SlottedScopeIdSource {
  return {
    value: value ? (isString(value) ? [value] : value) : null,
    parent,
    applyScopeId: applyFragmentScopeId,
  }
}

export function setFragmentSlottedScopeIdSource(
  fragment: VaporFragment,
  source: SlottedScopeIdSource,
): void {
  fragment.slottedScopeIdSource = source
  fragment.applyScopeId = source.applyScopeId
}

function bindFragmentScopeIdOwner(
  fragment: VaporFragment,
  instance: VaporComponentInstance,
): void {
  fragment.scopeOwner = instance
  fragment.applyScopeId ||= applyFragmentRootScopeId
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
    // Match VDOM: renderSlot()'s Fragment stops component root scope IDs from
    // reaching slot content or fallback.
    if (block.__vf & SLOT || (isTeleportEnabled && isTeleportFragment(block))) {
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
    const source = current.slottedScopeIdSource
    if (source) {
      scopeIds = mergeScopeIdsInternal(
        scopeIds,
        getSlottedScopeId(source),
        canMutate || scopeIds !== previous,
      )
    }
    if (previous && scopeIds !== previous) canMutate = true
    current = getScopeIdParent(current)
  }
  return scopeIds
}

export function setElementScopeId(element: Element, scopeIds: ScopeId): void {
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

function setMissingScopeId(
  element: Element,
  scopeIds: string | readonly string[],
): boolean {
  if (isString(scopeIds)) {
    if (element.hasAttribute(scopeIds)) return false
    element.setAttribute(scopeIds, '')
    return true
  }
  let changed = false
  for (let i = 0; i < scopeIds.length; i++) {
    const scopeId = scopeIds[i]
    if (!element.hasAttribute(scopeId)) {
      element.setAttribute(scopeId, '')
      changed = true
    }
  }
  return changed
}

function setElementSlottedScopeId(
  element: Element,
  scopeIds: string | readonly string[],
  isBlockRoot = false,
): void {
  if (isHydrating) {
    if (isRecreatedNode(element)) {
      runWithoutHydration(() =>
        setElementSlottedScopeId(element, scopeIds, isBlockRoot),
      )
    }
    return
  }
  const changed = setMissingScopeId(element, scopeIds)
  // The block root may have been tagged by an earlier shallow pass, so it
  // still traverses. Tagged descendants came from VDOM, which has already
  // propagated the context. Vapor component roots terminate the channel.
  if (!isBlockRoot && (!changed || (element as any).$root)) {
    return
  }
  let child = element.firstElementChild
  while (child) {
    const next = child.nextElementSibling
    setElementSlottedScopeId(child, scopeIds)
    child = next
  }
}

function applyCurrentSlottedScopeId(block: Block, scopeIds: ScopeId): void {
  if (!scopeIds) return
  if (block instanceof Element) {
    setElementSlottedScopeId(block, scopeIds, true)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      applyCurrentSlottedScopeId(block[i], scopeIds)
    }
  } else if (isFragment(block)) {
    applyCurrentSlottedScopeId(block.nodes, scopeIds)
  }
}

export function applySlottedScopeId(block: Block, scopeIds: ScopeId): void {
  if (!scopeIds) return
  if (block instanceof Element) {
    setElementSlottedScopeId(block, scopeIds, true)
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
    if (block.__vf & FOR_ITEM) {
      applySlottedScopeId(block.nodes, scopeIds)
      return
    }
    const merged = mergeScopeIds(block.slottedScopeId, scopeIds)
    if (merged === block.slottedScopeId) return
    block.slottedScopeId = merged
    block.applyScopeId = applyFragmentScopeId
    if (isInteropEnabled && isInteropFragment(block)) {
      if (block.vnode) {
        block.syncScopeId()
        // Component VNodes consume the ids through their own effective-root
        // inheritance; element or vnode-less roots have no update channel, so
        // already-mounted content is tagged directly below.
        if (block.vnode.shapeFlag & ShapeFlags.COMPONENT) return
      }
    } else if (block.parkedContent) {
      // Blocks parked outside `nodes` (slot content behind an active
      // fallback) still need ids so their nested fragments stamp their own
      // re-renders and the content re-exposes fully tagged.
      const parked = block.parkedContent()
      if (parked) applySlottedScopeId(parked, scopeIds)
    }
    applySlottedScopeId(block.nodes, scopeIds)
  }
}

// Update future mounts without touching existing elements: runtime-core
// applies slotScopeIds at mount only.
export function setFragmentSlottedScopeId(
  fragment: VaporFragment,
  scopeIds: ScopeId,
): void {
  if (isSameScopeIds(fragment.slottedScopeId, scopeIds)) return
  fragment.slottedScopeId = scopeIds
  fragment.applyScopeId = applyFragmentScopeId
}

function includesScopeId(
  scopeIds: string | readonly string[],
  scopeId: string,
): boolean {
  return isString(scopeIds) ? scopeIds === scopeId : scopeIds.includes(scopeId)
}

function removeScopeId(current: ScopeId, removed: ScopeId): ScopeId {
  if (!current || !removed || removed.length === 0) return current
  if (isString(current)) {
    return includesScopeId(removed, current) ? null : current
  }
  const filtered = current.filter(id => !includesScopeId(removed, id))
  if (filtered.length === current.length) return current
  return filtered.length ? filtered : null
}

// Swaps one context contribution for another inside a stored id set:
// contributions from other sources (an outlet's own ids, an outer ambient)
// survive the exchange.
export function replaceScopeId(
  current: ScopeId,
  prev: ScopeId,
  next: ScopeId,
): ScopeId {
  if (isSameScopeIds(current, prev)) return next
  return mergeScopeIds(removeScopeId(current, prev), next)
}

// A stable slot function keeps its block, so replace the old contribution
// throughout that block for future mounts. Existing DOM remains unchanged.
export function updateSlottedScopeId(
  block: Block,
  prev: ScopeId,
  next: ScopeId,
): void {
  if ((!prev && !next) || isSameScopeIds(prev, next)) return
  updateBlockSlottedScopeId(block, prev, next)
}

// Update the instance store used by future roots and republish mounted
// interop-root metadata without touching existing DOM.
function updateComponentSlottedScopeId(
  instance: VaporComponentInstance,
  prev: ScopeId,
  next: ScopeId,
): void {
  if (instance.slottedScopeIdSource) {
    syncComponentRootScopeId(instance)
    return
  }
  setInteropComponentScopeId(
    instance,
    replaceScopeId(instance.scopeId, prev, next),
  )
}

// Refreshes future-root wiring without rewriting an existing element root.
// Each level first confirms the effective single root, then registers its
// dynamic path — the same two-pass rule as applyRootScopeId.
export function syncComponentRootScopeId(
  instance: VaporComponentInstance,
): void {
  let componentRoot = instance
  let root: ScopeIdRootCandidate | undefined
  while (true) {
    const block = componentRoot.block
    root = block instanceof Element ? block : resolveSingleScopeIdRoot(block)
    if (!root) return
    if (isArray(block) || isFragment(block)) {
      resolveSingleScopeIdRoot(block, bindFragmentScopeIdOwner, componentRoot)
    }
    if (!isVaporComponent(root)) break
    root.inheritsScopeId = true
    componentRoot = root
  }
  if (
    root === DYNAMIC_ROOT_PLACEHOLDER ||
    root instanceof Element ||
    !isInteropEnabled
  ) {
    return
  }
  bindFragmentScopeIdOwner(root, componentRoot)
  root.syncScopeId()
}

function updateBlockSlottedScopeId(
  block: Block,
  prev: ScopeId,
  next: ScopeId,
): void {
  if (isVaporComponent(block)) {
    updateComponentSlottedScopeId(block, prev, next)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      updateBlockSlottedScopeId(block[i], prev, next)
    }
  } else if (isFragment(block)) {
    if (block.__vf & FOR_ITEM) {
      updateBlockSlottedScopeId(block.nodes, prev, next)
      return
    }
    if (!block.slottedScopeIdSource) {
      const replaced = replaceScopeId(block.slottedScopeId, prev, next)
      if (!isSameScopeIds(replaced, block.slottedScopeId)) {
        block.slottedScopeId = replaced
        block.applyScopeId = applyFragmentScopeId
      }
    }
    if (isInteropEnabled && isInteropFragment(block)) {
      const vnode = block.vnode
      if (vnode) {
        block.syncScopeId()
        if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
          // Component VNodes consume the ids through their own effective-root
          // inheritance; their subtree is not slot content of this context.
          // A mounted vapor component behind the VNode additionally keeps
          // its own store, which its future roots read.
          const instance = vnode.component as unknown
          if (isVaporComponent(instance)) {
            updateComponentSlottedScopeId(instance, prev, next)
          }
          return
        }
        // An element-backed subtree holds VNode metadata (nested component
        // and Fragment slotScopeIds) that future roots inherit; the block
        // walk below only sees its DOM nodes.
        block.updateScopeIdContext(prev, next)
      }
    } else if (block.parkedContent) {
      const parked = block.parkedContent()
      if (parked) updateBlockSlottedScopeId(parked, prev, next)
    }
    updateBlockSlottedScopeId(block.nodes, prev, next)
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
    const source = current.slottedScopeIdSource
    if (source) {
      setElementScopeId(element, getSlottedScopeId(source))
    }
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
      if (root.shapeFlag! & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        syncComponentRootScopeId(root)
      } else {
        applyRootScopeId(root.block, root)
      }
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
    (currentInstance.scopeId ||
      currentInstance.slottedScopeIdSource ||
      currentInstance.inheritsScopeId)
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
  // Interop mounts use null for an empty contribution so future vnode updates
  // still have root wiring; pure Vapor instances without ids use undefined.
  if (
    instance.scopeId === undefined &&
    !instance.slottedScopeIdSource &&
    !instance.inheritsScopeId
  ) {
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
  syncComponentRootScopeId(instance)
}

export function getCurrentScopeId(): string | undefined {
  const scopeOwner = getScopeOwner()
  return isVaporComponent(scopeOwner) ? scopeOwner.type.__scopeId : undefined
}
