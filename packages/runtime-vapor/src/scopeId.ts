import { isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  getRootElement,
  isVaporComponent,
} from './component'
import { getInheritedScopeIds } from '@vue/runtime-dom'
import {
  type DynamicFragment,
  type InteropFragment,
  type VaporFragment,
  isFragment,
  isInteropFragment,
} from './fragment'
import type { Block } from './block'
import { isInteropEnabled } from './vdomInteropState'
import { getScopeOwner } from './componentSlots'

export function setScopeId(block: Block, scopeIds: string[]): void {
  if (block instanceof Element) {
    for (const id of scopeIds) {
      block.setAttribute(id, '')
    }
  } else if (isVaporComponent(block)) {
    setScopeId(block.block, scopeIds)
  } else if (isArray(block)) {
    for (const b of block) {
      setScopeId(b, scopeIds)
    }
  } else if (isFragment(block)) {
    trackScopeIdFragment(block, scopeIds, false)
    setScopeId(block.nodes, scopeIds)
  }
}

const trackedScopeIdFragments = new WeakMap<VaporFragment, Set<string>>()

export function trackScopeIdFragment(
  frag: VaporFragment,
  scopeIds: string[],
  recursive = true,
): void {
  // VDOM interop fragments apply scope ids through their backing VNode instead
  // of the fragment insert hook.
  if (isInteropEnabled && isInteropFragment(frag)) {
    setInteropFragmentScopeIds(frag, scopeIds)
  } else if (trackFragmentScopeIds(frag, scopeIds)) {
    ;(frag.onBeforeInsert ||= []).push(nodes => setScopeId(nodes, scopeIds))
  }
  if (recursive) {
    trackScopeIdsInBlock(frag.nodes, scopeIds)
  }
}

function trackFragmentScopeIds(
  frag: VaporFragment,
  scopeIds: string[],
): boolean {
  const key = scopeIds.join(' ')
  let trackedScopeIds = trackedScopeIdFragments.get(frag)
  if (!trackedScopeIds) {
    trackedScopeIds = new Set()
    trackedScopeIdFragments.set(frag, trackedScopeIds)
  } else if (trackedScopeIds.has(key)) {
    return false
  }
  trackedScopeIds.add(key)
  return true
}

function setInteropFragmentScopeIds(
  frag: InteropFragment,
  scopeIds: string[],
): void {
  const vnode = frag.vnode
  if (!vnode) return
  const existing = vnode.slotScopeIds
  if (!existing) {
    vnode.slotScopeIds = scopeIds
    return
  }
  for (let i = 0; i < scopeIds.length; i++) {
    if (!existing.includes(scopeIds[i])) {
      existing.push(scopeIds[i])
    }
  }
}

function trackScopeIdsInBlock(block: Block, scopeIds: string[]): void {
  if (isVaporComponent(block)) {
    trackScopeIdsInBlock(block.block, scopeIds)
  } else if (isArray(block)) {
    for (const b of block) {
      trackScopeIdsInBlock(b, scopeIds)
    }
  } else if (isFragment(block)) {
    trackScopeIdFragment(block, scopeIds)
  }
}

const trackedInheritedScopeIdFragments = new WeakMap<
  DynamicFragment,
  WeakSet<VaporComponentInstance>
>()

function trackInheritedScopeIdFragment(
  instance: VaporComponentInstance,
  frag: DynamicFragment,
): void {
  // A dynamic root can inherit scope ids from multiple ancestor component
  // instances, so the de-dupe key must include the instance, not just the frag.
  let trackedInstances = trackedInheritedScopeIdFragments.get(frag)
  if (!trackedInstances) {
    trackedInstances = new WeakSet()
    trackedInheritedScopeIdFragments.set(frag, trackedInstances)
  } else if (trackedInstances.has(instance)) {
    return
  }
  trackedInstances.add(instance)
  ;(frag.onUpdated ||= []).push(() => applyInheritedScopeIdToRoot(instance))
}

function applyInheritedScopeIdToRoot(
  instance: VaporComponentInstance,
): Element | undefined {
  const { scopeId } = instance
  if (!scopeId) return
  // Re-resolve the effective single root on each dynamic update. This keeps
  // comment roots and multi-root branches aligned with VDOM root semantics.
  const root = getRootElement(instance, frag =>
    trackInheritedScopeIdFragment(instance, frag),
  )
  if (root) {
    root.setAttribute(scopeId, '')
  }
  return root
}

export function trackComponentScopeId(instance: VaporComponentInstance): void {
  const { parent, scopeId } = instance
  if (!parent || !scopeId) return
  getRootElement(instance, frag =>
    trackInheritedScopeIdFragment(instance, frag),
  )
}

export function setComponentScopeId(instance: VaporComponentInstance): void {
  const { parent, scopeId } = instance
  if (!parent || !scopeId) return

  const root = applyInheritedScopeIdToRoot(instance)

  // inherit scopeId from vdom parent
  if (
    isInteropEnabled &&
    root &&
    parent.subTree &&
    (parent.subTree.component as any) === instance &&
    parent.vnode!.scopeId
  ) {
    root.setAttribute(parent.vnode!.scopeId, '')
    const inheritedScopeIds = getInheritedScopeIds(parent.vnode!, parent.parent)
    for (let i = 0; i < inheritedScopeIds.length; i++) {
      root.setAttribute(inheritedScopeIds[i], '')
    }
  }
}
export function getCurrentScopeId(): string | undefined {
  const scopeOwner = getScopeOwner()
  return scopeOwner ? scopeOwner.type.__scopeId : undefined
}
