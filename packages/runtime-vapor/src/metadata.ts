import type { Data } from '@vue/shared'
import type { DelegatedHandler } from './dom/event'

export enum MetadataKind {
  prop,
  event,
}

export type ElementMetadata = [
  props: Data,
  events: Record<string, DelegatedHandler>,
]

export function getMetadata(
  el: Node & { $$metadata?: ElementMetadata },
): ElementMetadata {
  return el.$$metadata || (el.$$metadata = [{}, {}])
}

export function recordMetadata(
  el: Node,
  kind: MetadataKind,
  key: string,
  value: any,
): any {
  const metadata = getMetadata(el)[kind]
  const prev = metadata[key]
  metadata[key] = value
  return prev
}
