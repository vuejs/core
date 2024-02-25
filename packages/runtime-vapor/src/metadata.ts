import type { Data } from '@vue/shared'
import type { DelegatedHandler } from './dom/event'

export interface ElementMetadata {
  props: Data
  events: Record<string, DelegatedHandler>
}

export function getMetadata(
  el: Node & { $$metadata?: ElementMetadata },
): ElementMetadata {
  return (
    el.$$metadata ||
    (el.$$metadata = {
      props: {},
      events: {},
    })
  )
}

export function recordMetadata(
  el: Node,
  kind: 'props' | 'events',
  key: string,
  value: any,
): any {
  const metadata = getMetadata(el)[kind]
  const prev = metadata[key]
  metadata[key] = value
  return prev
}
