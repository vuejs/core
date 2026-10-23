import { type EffectScope, addChildScopesHook } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import type { Block } from './block'
import type { VaporComponentInstance } from './component'
import { isFragment, isInteropFragment } from './fragment'
import { RenderEffect } from './renderEffect'

/**
 * Registers the vapor side of the child scopes hook: component scopes are
 * detached, so a component's children are reached through its child list,
 * and the scopes of its v-for rows and v-if branches through its block tree.
 * Each child reports in turn.
 */
export function registerChildScopesHook(): void {
  addChildScopesHook(vaporChildScopes)
}

function vaporChildScopes(
  scope: EffectScope,
  fn: (child: EffectScope) => void,
): void {
  const instance = ownerOf(scope)
  if (instance) {
    forEachChild(instance, fn)
    forEachScopeIn(instance.block, fn)
  }
}

// components without a render effect of their own, by scope
const staticOwners = new WeakMap<EffectScope, VaporComponentInstance>()

/**
 * Called once a component has rendered: a component without reactive
 * bindings has no render effect to find it by, so it is registered.
 */
export function registerScopeOwner(instance: VaporComponentInstance): void {
  if (renderEffectOwner(instance.scope) === null) {
    staticOwners.set(instance.scope, instance)
  }
}

function ownerOf(scope: EffectScope): VaporComponentInstance | null {
  return renderEffectOwner(scope) || staticOwners.get(scope) || null
}

/**
 * The instance whose scope this is, found through one of its render effects.
 * Render effects are created after setup, so they sit at the tail of `deps`.
 */
function renderEffectOwner(scope: EffectScope): VaporComponentInstance | null {
  for (let link = scope.depsTail; link !== undefined; link = link.prevDep) {
    const dep = link.dep
    if (dep instanceof RenderEffect && dep.i && dep.i.scope === scope) {
      return dep.i
    }
  }
  return null
}

function forEachChild(
  instance: VaporComponentInstance,
  fn: (scope: EffectScope) => void,
): void {
  const first = instance.firstChild
  if (first === null) return
  // a handed-over scope may unmount a sibling: read the link first
  let child = first
  do {
    const next = child.nextSibling
    if (child.inputScope) {
      fn(child.inputScope)
    }
    fn(child.scope)
    child = next!
  } while (child !== null && child !== first && child !== instance.firstChild)
}

// the scopes kept by fragments: v-for rows, v-if branches, interop inputs,
// and the vdom components rendered through interop (they report through the
// vdom hook)
function forEachScopeIn(block: Block, fn: (scope: EffectScope) => void): void {
  if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      forEachScopeIn(block[i], fn)
    }
  } else if (isFragment(block)) {
    if (block.scope) {
      fn(block.scope)
    }
    if (block.inputScope) {
      fn(block.inputScope)
    }
    if (isInteropFragment(block)) {
      const vnode = block.vnode
      if (vnode && vnode.component) {
        fn(vnode.component.scope)
      }
    } else {
      forEachScopeIn(block.nodes, fn)
    }
  }
  // a component met here is in its parent's child list and reports its own
  // fragments
}
