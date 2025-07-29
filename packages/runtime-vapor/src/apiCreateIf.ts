import { IF_ANCHOR_LABEL } from '@vue/shared'
import { type Block, type BlockFn, insert } from './block'
import { isHydrating } from './dom/hydration'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { renderEffect } from './renderEffect'
import { DynamicFragment } from './fragment'

const ifStack = [] as DynamicFragment[]
const insertionParents = new WeakMap<DynamicFragment, Node[]>()

/**
 * Collects insertionParents inside an if block during hydration
 * When the if condition becomes false on the client, clears the
 * HTML of these insertionParents to prevent duplicate rendering
 * results when the condition becomes true again
 *
 * Example:
 * const t2 = _template("<div></div>")
 * const n2 = _createIf(() => show.value, () => {
 *   const n5 = t2()
 *   _setInsertionState(n5)
 *   const n4 = _createComponent(Comp) // renders `<span></span>`
 *   return n5
 * })
 *
 * After hydration, the HTML of `n5` is `<div><span></span></div>` instead of `<div></div>`.
 * When `show.value` becomes false, the HTML of `n5` needs to be cleared,
 * to avoid duplicated rendering when `show.value` becomes true again.
 */
export function collectInsertionParents(insertionParent: ParentNode): void {
  const currentIf = ifStack[ifStack.length - 1]
  if (currentIf) {
    let nodes = insertionParents.get(currentIf)
    if (!nodes) insertionParents.set(currentIf, (nodes = []))
    nodes.push(insertionParent)
  }
}

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()

  let frag: Block
  if (once) {
    frag = condition() ? b1() : b2 ? b2() : []
  } else {
    frag =
      isHydrating || __DEV__
        ? new DynamicFragment(IF_ANCHOR_LABEL)
        : new DynamicFragment()
    if (isHydrating) {
      ;(frag as DynamicFragment).teardown = () => {
        const nodes = insertionParents.get(frag as DynamicFragment)
        if (nodes) {
          nodes.forEach(p => ((p as Element).innerHTML = ''))
          insertionParents.delete(frag as DynamicFragment)
        }
        ;(frag as DynamicFragment).teardown = undefined
      }
      ifStack.push(frag as DynamicFragment)
    }
    renderEffect(() => (frag as DynamicFragment).update(condition() ? b1 : b2))
    isHydrating && ifStack.pop()
  }

  if (!isHydrating && _insertionParent) {
    insert(frag, _insertionParent, _insertionAnchor)
  }

  return frag
}
