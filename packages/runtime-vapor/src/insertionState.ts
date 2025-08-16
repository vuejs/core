export let insertionParent:
  | (ParentNode & {
      // the latest prepend node
      $lpn?: Node
      // the latest insert node
      $lin?: Node
      // the latest append node
      $lan?: Node
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
