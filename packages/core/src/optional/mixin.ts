import { ComponentInstance, ComponentType } from '../component'
import { ComponentOptions } from '../componentOptions'
import { RawVNodeChildren, VNodeData } from '../vdom'

export interface Mixin extends ComponentOptions {}

export function applyMixins(Component: ComponentInstance, mixins: Mixin[]) {}

export function h(tag: ComponentType | string, data: RawVNodeChildren): object
export function h(
  tag: ComponentType | string,
  data: VNodeData,
  children: RawVNodeChildren
): object {
  return {}
}
