import type { Data } from '@vue/shared'

export interface ElementMetadata {
  props: Data
}

export function getMetadata(
  el: Node & { $$metadata?: ElementMetadata },
): ElementMetadata {
  return el.$$metadata || (el.$$metadata = { props: {} })
}

export function recordPropMetadata(el: Node, key: string, value: any): any {
  const metadata = getMetadata(el)
  const prev = metadata.props[key]
  metadata.props[key] = value
  return prev
}
