import {
  type Component,
  type ComponentInternalInstance,
  type Slots,
  type VNode,
  createVNode,
} from 'vue'
import {
  type Props,
  type PushFn,
  type SSRBuffer,
  renderComponentVNode,
  renderVNode as ssrRenderVNode,
} from '../render'
import { type SSRSlots, ssrRenderSlot } from './ssrRenderSlot'

export function ssrRenderSkipComponent(
  push: PushFn,
  isSkip: boolean,
  comp: Component,
  props: Props | null = null,
  children: Slots | SSRSlots | null = null,
  parentComponent: ComponentInternalInstance | null = null,
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  if (isSkip) {
    // only render default slot without slot props
    ssrRenderSlot(
      children!,
      'default',
      {},
      null,
      push,
      parentComponent!,
      slotScopeId,
    )
    return []
  }
  return renderComponentVNode(
    createVNode(comp, props, children),
    parentComponent,
    slotScopeId,
  )
}

export function ssrRenderSkipVNode(
  isSkip: boolean,
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
): void {
  if (isSkip) {
    ssrRenderSlot(
      vnode.children as Slots,
      'default',
      {},
      null,
      push,
      parentComponent,
      slotScopeId,
    )
  } else {
    ssrRenderVNode(push, vnode, parentComponent, slotScopeId)
  }
}
