import {
  ComponentInternalInstance,
  createVNode,
  NULL_DYNAMIC_COMPONENT
} from 'vue'
import { Props, renderVNode, PushFn } from '../render'

// for dynamic components that resolve to normal element
export function ssrRenderVNode(
  tag: string | typeof NULL_DYNAMIC_COMPONENT,
  props: Props | null = null,
  children: unknown = null,
  push: PushFn,
  parentComponent: ComponentInternalInstance
) {
  renderVNode(push, createVNode(tag, props, children), parentComponent)
}
