import { isArray } from '@vue/shared'
import { type VaporComponentInstance, isVaporComponent } from './component'
import { getInheritedScopeIds } from '@vue/runtime-dom'
import { isFragment } from './fragment'
import type { Block } from './block'
import { isInteropEnabled } from './vdomInteropState'

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
    setScopeId(block.nodes, scopeIds)
  }
}

export function setComponentScopeId(instance: VaporComponentInstance): void {
  const { parent, scopeId } = instance
  if (!parent || !scopeId) return

  // prevent setting scopeId on multi-root fragments
  if (isArray(instance.block) && instance.block.length > 1) return

  const scopeIds: string[] = []
  const parentScopeId = parent && parent.type.__scopeId
  // if parent scopeId is different from scopeId, this means scopeId
  // is inherited from slot owner, so we need to set it to the component
  // scopeIds. the `parentScopeId-s` is handled in createSlot
  if (parentScopeId !== scopeId) {
    scopeIds.push(scopeId)
  } else {
    if (parentScopeId) scopeIds.push(parentScopeId)
  }

  // inherit scopeId from vdom parent
  if (
    isInteropEnabled &&
    parent.subTree &&
    (parent.subTree.component as any) === instance &&
    parent.vnode!.scopeId
  ) {
    scopeIds.push(parent.vnode!.scopeId)
    const inheritedScopeIds = getInheritedScopeIds(parent.vnode!, parent.parent)
    scopeIds.push(...inheritedScopeIds)
  }

  if (scopeIds.length > 0) {
    setScopeId(instance.block, scopeIds)
  }
}
