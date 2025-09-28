import { isHydrating } from './dom/hydration'
export type ChildItem = ChildNode & {
  $idx: number
  // used count as an anchor
  $uc?: number
}

export type InsertionParent = ParentNode & {
  $prependAnchor?: Node | null

  /**
   * hydration-specific properties
   */
  // hydrated dynamic children count so far
  $prevDynamicCount?: number
  // number of unique insertion anchors that have appeared
  $anchorCount?: number
  // last append index
  $appendIndex?: number | null
  // last located logical child
  $lastLogicalChild?: Node | null
}
export let insertionParent: InsertionParent | undefined
export let insertionAnchor: Node | 0 | undefined | null

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created. The state is used for actual
 * insertion on client-side render, and used for node adoption during hydration.
 */
export function setInsertionState(
  parent: ParentNode & { $prependAnchor?: Node | null },
  anchor?: Node | 0 | null | number,
): void {
  insertionParent = parent

  if (anchor !== undefined) {
    if (isHydrating) {
      insertionAnchor = anchor as Node
      // when the setInsertionState is called for the first time, reset $lastLogicalChild,
      // in order to reuse it in locateChildByLogicalIndex
      if (insertionParent.$prevDynamicCount === undefined) {
        insertionParent!.$lastLogicalChild = null
      }
    } else {
      // special handling append anchor value to null
      insertionAnchor =
        typeof anchor === 'number' && anchor > 0 ? null : (anchor as Node)

      // track the first child for potential future use
      if (anchor === 0 && !parent.$prependAnchor) {
        parent.$prependAnchor = parent.firstChild
      }
    }
  } else {
    insertionAnchor = undefined
  }
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = undefined
}
