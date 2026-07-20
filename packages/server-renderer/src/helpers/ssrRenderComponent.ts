import {
  type Component,
  type ComponentInternalInstance,
  type Slots,
  createVNode,
} from '@vue/runtime-dom'
import { isString } from '@vue/shared'
import {
  type Props,
  type SSRBuffer,
  createBuffer,
  renderComponentVNode,
  renderVNode,
} from '../render'
import type { SSRSlots } from './ssrRenderSlot'

export function ssrRenderComponent(
  comp: Component | string,
  props: Props | null = null,
  children: Slots | SSRSlots | null = null,
  parentComponent: ComponentInternalInstance | null = null,
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  if (isString(comp)) {
    // resolveComponent() can fall back to the original tag string; render it
    // through the element path so SSR matches the client plain-element fallback.
    const { getBuffer, push } = createBuffer()
    renderVNode(
      push,
      createVNode(comp, props, children),
      parentComponent as ComponentInternalInstance,
      slotScopeId,
    )
    return getBuffer()
  }

  return renderComponentVNode(
    createVNode(comp, props, children),
    parentComponent,
    slotScopeId,
  )
}
