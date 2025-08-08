export let insertionParent:
  | (ParentNode & {
      // number of prepends - hydration only
      // consecutive prepends need to skip nodes that were prepended earlier
      // each prepend increases the value of $prepend
      $np?: number
    })
  | undefined
export let insertionAnchor: Node | 0 | undefined

export let insertionChildIndex: number | undefined

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created. The state is used for actual
 * insertion on client-side render, and used for node adoption during hydration.
 */
export function setInsertionState(
  parent: ParentNode,
  anchor?: Node | 0,
  offset?: number,
): void {
  insertionParent = parent
  insertionAnchor = anchor
  insertionChildIndex = offset
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = insertionChildIndex = undefined
}
