import { isFunction } from '@vue/shared'
import { Component, ComponentInternalInstance, createVNode, Slots } from 'vue'
import { Props, renderComponentVNode, SSRBuffer } from '../render'
import { SSRSlots } from './ssrRenderSlot'

export function ssrRenderComponent(
  comp: Component,
  props: Props | null = null,
  children: Slots | SSRSlots | null = null,
  parentComponent: ComponentInternalInstance | null = null,
  slotScopeId?: string
): SSRBuffer | Promise<SSRBuffer> {
  return renderComponentVNode(
    isFunction(comp) && parentComponent
      ? (parentComponent.subTree = createVNode(comp, props, children))
      : createVNode(comp, props, children),
    parentComponent,
    slotScopeId
  )
}
