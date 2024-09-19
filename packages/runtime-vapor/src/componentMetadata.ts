import { remove } from '@vue/shared'
import type { DelegatedHandler } from './dom/event'
import type { Data } from '@vue/runtime-shared'

export enum MetadataKind {
  prop,
  event,
}

export type ComponentMetadata = [
  props: Data,
  events: Record<string, DelegatedHandler[]>,
]

export function getMetadata(
  el: Node & { $$metadata?: ComponentMetadata },
): ComponentMetadata {
  return el.$$metadata || (el.$$metadata = [{}, {}])
}

export function recordPropMetadata(el: Node, key: string, value: any): any {
  const metadata = getMetadata(el)[MetadataKind.prop]
  const prev = metadata[key]
  if (prev !== value) metadata[key] = value
  return prev
}

export function recordEventMetadata(el: Node, key: string, value: any) {
  const metadata = getMetadata(el)[MetadataKind.event]
  const handlers = (metadata[key] ||= [])
  handlers.push(value)
  return (): void => remove(handlers, value)
}
