export let insertionParent: ParentNode | undefined
export let insertionAnchor: Node | 0 | undefined

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created. The state is used for actual
 * insertion on client-side render, and used for node adoption during hydration.
 */
export function setInsertionState(
  parent: ParentNode & { $anchor?: Node | null },
  anchor?: Node | 0,
): void {
  // When setInsertionState(n3, 0) is called consecutively, the first prepend operation
  // uses parent.firstChild as the anchor. However, after insertion, parent.firstChild
  // changes and cannot serve as the anchor for subsequent prepends. Therefore, we cache
  // the original parent.firstChild on the first call for subsequent prepend operations.
  if (anchor === 0 && !parent.$anchor) {
    parent.$anchor = parent.firstChild
  }

  insertionParent = parent
  insertionAnchor = anchor
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = undefined
}
