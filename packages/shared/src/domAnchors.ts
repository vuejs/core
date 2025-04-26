export const DYNAMIC_START_ANCHOR_LABEL = '[['
export const DYNAMIC_END_ANCHOR_LABEL = ']]'

export const IF_ANCHOR_LABEL: string = 'if'
export const DYNAMIC_COMPONENT_ANCHOR_LABEL: string = 'dynamic-component'
export const FOR_ANCHOR_LABEL: string = 'for'
export const SLOT_ANCHOR_LABEL: string = 'slot'

export function isDynamicAnchor(node: Node): node is Comment {
  if (node.nodeType !== 8) return false

  const data = (node as Comment).data
  return (
    data === DYNAMIC_START_ANCHOR_LABEL || data === DYNAMIC_END_ANCHOR_LABEL
  )
}

export function isVaporFragmentEndAnchor(node: Node): node is Comment {
  if (node.nodeType !== 8) return false

  const data = (node as Comment).data
  return (
    data === IF_ANCHOR_LABEL ||
    data === FOR_ANCHOR_LABEL ||
    data === SLOT_ANCHOR_LABEL ||
    data === DYNAMIC_COMPONENT_ANCHOR_LABEL
  )
}
