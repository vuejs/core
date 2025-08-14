export let insertionParent:
  | (ParentNode & {
      $ps?: Node
      $pa?: Node
      $ia?: Node
      $aa?: Node
    })
  | undefined
export let insertionAnchor: Node | 0 | undefined | null

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created. The state is used for actual
 * insertion on client-side render, and used for node adoption during hydration.
 */
export function setInsertionState(
  parent: ParentNode,
  anchor?: Node | 0 | null,
): void {
  insertionParent = parent
  insertionAnchor = anchor
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = undefined
}
