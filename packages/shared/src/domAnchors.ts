export const BLOCK_INSERTION_ANCHOR_LABEL = 'i'
export const BLOCK_APPEND_ANCHOR_LABEL = 'a'
export const BLOCK_PREPEND_ANCHOR_LABEL = 'p'
export const IF_ANCHOR_LABEL: string = 'if'
export const DYNAMIC_COMPONENT_ANCHOR_LABEL: string = 'dynamic-component'
export const FOR_ANCHOR_LABEL: string = 'for'
export const SLOT_ANCHOR_LABEL: string = 'slot'

export function isInsertionAnchor(node: Node): node is Comment {
  if (node.nodeType !== 8) return false
  const data = (node as Comment).data
  return (
    data === `[${BLOCK_INSERTION_ANCHOR_LABEL}` ||
    data === `[${BLOCK_APPEND_ANCHOR_LABEL}` ||
    data === `[${BLOCK_PREPEND_ANCHOR_LABEL}`
  )
}
