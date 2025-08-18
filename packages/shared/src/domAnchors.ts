export const BLOCK_ANCHOR_START_LABEL = '[['
export const BLOCK_ANCHOR_END_LABEL = ']]'
export const IF_ANCHOR_LABEL: string = 'if'
export const DYNAMIC_COMPONENT_ANCHOR_LABEL: string = 'dynamic-component'
export const FOR_ANCHOR_LABEL: string = 'for'
export const SLOT_ANCHOR_LABEL: string = 'slot'

export function isBlockStartAnchor(node: Node): node is Comment {
  if (node.nodeType !== 8) return false
  const data = (node as Comment).data
  return data === `${BLOCK_ANCHOR_START_LABEL}`
}
