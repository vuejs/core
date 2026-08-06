export type ChildItem = ChildNode & {
  // logical index, used during hydration to locate the node
  $idx: number
}

export type InsertionParent = ParentNode & {
  // last located logical child (hydration cache).
  // invariant: whenever $llc is set, $idx is set on that node.
  $llc?: Node | null
}
export let insertionParent: InsertionParent | undefined
export let insertionAnchor: Node | undefined
// hydration start unit index for appends
export let insertionIndex: number | undefined

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created.
 *
 * - `anchor` is a Node: insert before this template `<!>` placeholder during
 *   client render; during hydration the located placeholder unit is the
 *   block's hydration target.
 * - `anchor` is a number: append; the value is the hydration start unit index
 *   (the count of preceding logical units), omitted by codegen when 0.
 * - `anchor` absent: append with no preceding units.
 */
export function setInsertionState(
  parent: ParentNode,
  anchor?: Node | number,
): void {
  insertionParent = parent
  if (typeof anchor === 'number') {
    insertionAnchor = undefined
    insertionIndex = anchor
  } else {
    insertionAnchor = anchor
    insertionIndex = undefined
  }
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = insertionIndex = undefined
}
