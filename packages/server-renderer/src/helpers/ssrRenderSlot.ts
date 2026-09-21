import {
  type ComponentInternalInstance,
  type Slots,
  getCurrentInstance,
  ssrUtils,
} from '@vue/runtime-dom'
import {
  type Props,
  type PushFn,
  type SSRBufferItem,
  renderVNodeChildren,
  vaporSlotFns,
} from '../render'
import { isArray } from '@vue/shared'

const { ensureValidVNode } = ssrUtils

// vapor slots rendered so far: an outlet reads it around its slot function to
// learn whether one rendered inside
let vaporSlots = 0

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
  // can be nullish when `v-bind` on the `<slot>` evaluates to nullish
  slotProps: Props | null | undefined,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
): void {
  ssrRenderSlotInner(
    slots,
    slotName,
    slotProps,
    fallbackRenderFn,
    push,
    parentComponent,
    slotScopeId,
  )
}

export function ssrRenderSlotInner(
  slots: Slots | SSRSlots,
  slotName: string,
  slotProps: Props | null | undefined,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
  // a transition renders the slot bare: otherwise it is a range, `<!--(-->`
  // around the fallback, which a vapor client has to know before it renders
  // anything
  transition?: boolean,
): void {
  const slotFn = slots[slotName]
  let fallback = false
  if (slotFn) {
    if (vaporSlotFns.has(slotFn)) vaporSlots++
    const before = vaporSlots
    const slotBuffer: SSRBufferItem[] = []
    const bufferedPush = (item: SSRBufferItem) => {
      slotBuffer.push(item)
    }
    const ret = slotFn(
      // keep the slot function's contract in sync with `renderSlot`, which also
      // normalizes nullish props before invoking the slot
      slotProps || {},
      bufferedPush,
      parentComponent,
      slotScopeId ? ' ' + slotScopeId : '',
    )
    if (isArray(ret)) {
      const validSlotContent = ensureValidVNode(ret)
      if (!transition) {
        fallback = !validSlotContent && !!fallbackRenderFn
        push(fallback ? `<!--(-->` : `<!--[-->`)
      }
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
      } else if (transition) {
        push(`<!---->`)
      }
    } else {
      // ssr slot.
      // check if the slot renders all comments, in which case use the fallback
      let isEmptySlot = true
      // A vdom outlet forwarding a vapor slot keeps its range around it, as the
      // client keeps its fragment however little the slot renders. The outlet
      // rendering the vapor slot itself has the slot's own range instead.
      const owner = getCurrentInstance()
      if (
        transition ||
        (!(owner && owner.type.__vapor) &&
          !fallbackRenderFn &&
          vaporSlots !== before)
      ) {
        isEmptySlot = false
      } else {
        for (let i = 0; i < slotBuffer.length; i++) {
          if (!isComment(slotBuffer[i])) {
            isEmptySlot = false
            break
          }
        }
      }
      if (!transition) {
        fallback = isEmptySlot && !!fallbackRenderFn
        push(fallback ? `<!--(-->` : `<!--[-->`)
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
        if (transition) {
          const first = slotBuffer[0]
          if (
            (first === '<!--[-->' || first === '<!--(-->') &&
            slotBuffer[end - 1] ===
              (first === '<!--(-->' ? '<!--)-->' : '<!--]-->')
          ) {
            start++
            end--
          }
        }

        if (start < end) {
          for (let i = start; i < end; i++) {
            push(slotBuffer[i])
          }
        } else if (transition) {
          push(`<!---->`)
        }
      }
    }
  } else {
    if (!transition) {
      fallback = !!fallbackRenderFn
      push(fallback ? `<!--(-->` : `<!--[-->`)
    }
    if (fallbackRenderFn) {
      fallbackRenderFn()
    } else if (transition) {
      push(`<!---->`)
    }
  }
  if (!transition) push(fallback ? `<!--)-->` : `<!--]-->`)
}

const commentTestRE = /^<!--[\s\S]*-->$/
const commentRE = /<!--[^]*?-->/gm
function isComment(item: SSRBufferItem) {
  if (typeof item !== 'string' || !commentTestRE.test(item)) return false
  // if item is '<!---->' or '<!--[-->' or '<!--]-->', return true directly
  if (item.length <= 8) return true
  return !item.replace(commentRE, '').trim()
}
