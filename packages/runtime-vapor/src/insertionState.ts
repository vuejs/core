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
 * Establishes global insertion state used for subsequent DOM insertion or node adoption during hydration.
 *
 * @param parent - The parent node under which new nodes will be inserted; may receive a cached first-child in `parent.$fc`.
 * @param anchor - A DOM node to use as the insertion anchor, `0` to indicate the position before the first child, or `null`/`undefined` for no anchor.
 * @param logicalIndex - Optional logical index used during hydration to locate where nodes should be adopted.
 * @param last - Optional flag indicating this insertion is the last within its containing sequence.
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

/**
 * Clear any active insertion state used for client-side insertion and hydration.
 *
 * Resets `insertionParent`, `insertionAnchor`, `insertionIndex`, and `isLastInsertion` to `undefined`.
 */
export function resetInsertionState(): void {
  insertionParent =
    insertionAnchor =
    insertionIndex =
    isLastInsertion =
      undefined
}