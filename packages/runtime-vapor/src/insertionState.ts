export let insertionParent:
  | (ParentNode & {
      // cached the last dynamic start anchor
      $lds?: Anchor
    })
  | undefined
export let insertionAnchor: Node | 0 | undefined | null

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created. The state is used for actual
 * insertion on client-side render, and used for node adoption during hydration.
 */
export function setInsertionState(parent: ParentNode, anchor?: Node | 0): void {
  insertionParent = parent
  insertionAnchor = anchor
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = undefined
}

export function setInsertionAnchor(anchor: Node | null): void {
  insertionAnchor = anchor
}

export type Anchor = Comment & {
  // cached matching fragment start to avoid repeated traversal
  // on nested fragments
  $fs?: Anchor
}
