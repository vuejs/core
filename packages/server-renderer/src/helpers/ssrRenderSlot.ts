import { type ComponentInternalInstance, type Slots, ssrUtils } from 'vue'
import {
  type Props,
  type PushFn,
  type SSRBufferItem,
  renderVNodeChildren,
} from '../render'
import { isArray } from '@vue/shared'

const { ensureValidVNode } = ssrUtils

export type SSRSlots = Record<string, SSRSlot>
export type SSRSlot = (
  props: Props,
  push: PushFn,
  parentComponent: ComponentInternalInstance | null,
  scopeId: string | null,
) => void

export function ssrRenderSlot(
  slots: Slots | SSRSlots,
  slotName: string,
  slotProps: Props,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
): void {
  // template-compiled slots are always rendered as fragments
  push(`<!--[-->`)
  ssrRenderSlotInner(
    slots,
    slotName,
    slotProps,
    fallbackRenderFn,
    push,
    parentComponent,
    slotScopeId,
  )
  push(`<!--]-->`)
}

export function ssrRenderSlotInner(
  slots: Slots | SSRSlots,
  slotName: string,
  slotProps: Props,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
  transition?: boolean,
): void {
  const slotFn = slots[slotName]
  if (slotFn) {
    const slotBuffer: SSRBufferItem[] = []
    const bufferedPush = (item: SSRBufferItem) => {
      slotBuffer.push(item)
    }
    const ret = slotFn(
      slotProps,
      bufferedPush,
      parentComponent,
      slotScopeId ? ' ' + slotScopeId : '',
    )
    if (isArray(ret)) {
      const validSlotContent = ensureValidVNode(ret)
      if (validSlotContent) {
        // normal slot
        renderVNodeChildren(
          push,
          validSlotContent,
          parentComponent,
          slotScopeId,
        )
      } else if (fallbackRenderFn) {
        fallbackRenderFn()
      }
    } else {
      // ssr slot.
      // check if the slot renders all comments, in which case use the fallback
      let isEmptySlot = true
      if (transition) {
        isEmptySlot = false
      } else {
        for (let i = 0; i < slotBuffer.length; i++) {
          if (!isComment(slotBuffer[i])) {
            isEmptySlot = false
            break
          }
        }
      }
      if (isEmptySlot) {
        if (fallbackRenderFn) {
          fallbackRenderFn()
        }
      } else {
        // #9933
        // Although we handle Transition/TransitionGroup in the transform stage
        // without rendering it as a fragment, the content passed into the slot
        // may still be a fragment.
        // Therefore, here we need to avoid rendering it as a fragment again.
        let start = 0
        let end = slotBuffer.length
        if (
          transition &&
          slotBuffer[0] === '<!--[-->' &&
          slotBuffer[end - 1] === '<!--]-->'
        ) {
          start++
          end--
        }

        for (let i = start; i < end; i++) {
          push(slotBuffer[i])
        }
      }
    }
  } else if (fallbackRenderFn) {
    fallbackRenderFn()
  }
}

const commentTestRE = /^<!--[\s\S]*-->$/
const commentRE = /<!--[^]*?-->/gm
function isComment(item: SSRBufferItem) {
  if (typeof item !== 'string' || !commentTestRE.test(item)) return false
  // if item is '<!---->' or '<!--[-->' or '<!--]-->', return true directly
  if (item.length <= 8) return true
  return !item.replace(commentRE, '').trim()
}
