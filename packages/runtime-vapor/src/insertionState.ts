import { isHydrating } from './dom/hydration'
export type ChildItem = ChildNode & {
  // logical index, used during hydration to locate the node
  $idx: number
}

export type InsertionParent = ParentNode & {
  // cache the first child for potential consecutive prepends
  $fc?: Node | null

  // last located logical child
  $llc?: Node | null
}
export let insertionParent: InsertionParent | undefined
export let insertionAnchor: Node | 0 | undefined | null
// logical index for hydration
export let insertionIndex: number | undefined

// indicates whether the insertion is the last one in the parent.
// if true, means no more nodes need to be hydrated after this insertion,
// advancing current hydration node to parent nextSibling
export let isLastInsertion: boolean | undefined

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created. The state is used for actual
 * insertion on client-side render, and used for node adoption during hydration.
 */
export function setInsertionState(
  parent: ParentNode & { $fc?: Node | null },
  anchor?: Node | 0 | null,
  logicalIndex?: number,
  last?: boolean,
): void {
  insertionParent = parent
  isLastInsertion = last
  insertionIndex = logicalIndex

  if (anchor !== undefined) {
    if (isHydrating) {
      // hydration uses logicalIndex, not anchor
      insertionAnchor = undefined
    } else {
      insertionAnchor = anchor
      if (anchor === 0 && !parent.$fc) {
        parent.$fc = parent.firstChild
      }
    }
  } else {
    insertionAnchor = undefined
  }
}

export function resetInsertionState(): void {
  insertionParent =
    insertionAnchor =
    insertionIndex =
    isLastInsertion =
      undefined
}
