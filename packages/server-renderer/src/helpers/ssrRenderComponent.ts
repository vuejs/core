import {
  Component,
  ComponentInternalInstance,
  createVNode,
  Slots,
  resolveDynamicComponent,
  NULL_DYNAMIC_COMPONENT
} from 'vue'
import { Props, renderComponentVNode, SSRBuffer } from '../render'
import { SSRSlots } from './ssrRenderSlot'

export function ssrRenderComponent(
  comp: Component,
  props: Props | null = null,
  children: Slots | SSRSlots | null = null,
  parentComponent: ComponentInternalInstance | null = null
): SSRBuffer | Promise<SSRBuffer> {
  return renderComponentVNode(
    createVNode(comp, props, children),
    parentComponent
  )
}

export function ssrIsComponent(
  comp: ReturnType<typeof resolveDynamicComponent>
) {
  return typeof comp !== 'string' && comp !== NULL_DYNAMIC_COMPONENT
}
