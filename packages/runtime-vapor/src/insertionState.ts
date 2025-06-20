export let insertionParent: ParentNode | undefined
export let insertionAnchor: Node | 0 | undefined

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created. The state is used for actual
 * insertion on client-side render, and used for node adoption during hydration.
 *
 * @returns A function that restores the previous insertion state when called.
 */
export function setInsertionState(parent?: ParentNode, anchor?: Node | 0) {
  const prevParent = insertionParent
  const prevAnchor = insertionAnchor
  insertionParent = parent
  insertionAnchor = anchor
  return (): void => {
    insertionParent = prevParent
    insertionAnchor = prevAnchor
  }
}
