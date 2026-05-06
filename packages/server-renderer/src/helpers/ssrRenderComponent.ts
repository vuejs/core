import {
  type Component,
  type ComponentInternalInstance,
  type Slots,
  createVNode,
} from 'vue'
import { type Props, type SSRBuffer, renderComponentVNode } from '../render'
import type { SSRSlots } from './ssrRenderSlot'

export function ssrRenderComponent(
  comp: Component,
  props: Props | null = null,
  children: Slots | SSRSlots | null = null,
  parentComponent: ComponentInternalInstance | null = null,
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  return renderComponentVNode(
    createVNode(comp, props, children),
    parentComponent,
    slotScopeId,
  )
}
