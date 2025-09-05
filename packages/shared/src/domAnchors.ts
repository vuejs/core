export const IF_ANCHOR_LABEL: string = 'if'
export const DYNAMIC_COMPONENT_ANCHOR_LABEL: string = 'dynamic-component'
export const FOR_ANCHOR_LABEL: string = 'for'
export const SLOT_ANCHOR_LABEL: string = 'slot'

export function isFragmentAnchors(label: string): boolean {
  return (
    label === IF_ANCHOR_LABEL ||
    label === DYNAMIC_COMPONENT_ANCHOR_LABEL ||
    label === FOR_ANCHOR_LABEL ||
    label === SLOT_ANCHOR_LABEL
  )
}
