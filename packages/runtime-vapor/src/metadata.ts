import { type Data, remove } from '@vue/shared'
import type { DelegatedHandler } from './dom/event'

export enum MetadataKind {
  prop,
  event,
}

export type ElementMetadata = [
  props: Data,
  events: Record<string, DelegatedHandler[]>,
]

export function getMetadata(
  el: Node & { $$metadata?: ElementMetadata },
): ElementMetadata {
  return el.$$metadata || (el.$$metadata = [{}, {}])
}

export function recordPropMetadata(el: Node, key: string, value: any): any {
  const metadata = getMetadata(el)[MetadataKind.prop]
  const prev = metadata[key]
  metadata[key] = value
  return prev
}

export function recordEventMetadata(el: Node, key: string, value: any) {
  const metadata = getMetadata(el)[MetadataKind.event]
  const handlers = (metadata[key] ||= [])
  handlers.push(value)
  return () => remove(handlers, value)
}
