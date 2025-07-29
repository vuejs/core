import { collectInsertionParents } from './apiCreateIf'
import { isHydrating } from './dom/hydration'

export let insertionParent:
  | (ParentNode & {
      // dynamic node position - hydration only
      // indicates the position where dynamic nodes begin within the parent
      // during hydration, static nodes before this index are skipped
      //
      // Example:
      // const t0 = _template("<div><span></span><span></span></div>", true)
      // const n4 = t0(2) // n4.$dp = 2
      // The first 2 nodes are static, dynamic nodes start from index 2
      $dp?: number
    })
  | undefined
export let insertionAnchor: Node | 0 | undefined

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created. The state is used for actual
 * insertion on client-side render, and used for node adoption during hydration.
 */
export function setInsertionState(parent: ParentNode, anchor?: Node | 0): void {
  insertionParent = parent
  insertionAnchor = anchor

  if (isHydrating) {
    collectInsertionParents(parent)
  }
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = undefined
}
