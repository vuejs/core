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
  // can be nullish when `v-bind` on the `<slot>` evaluates to nullish
  slotProps: Props | null | undefined,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
): void {
  // template-compiled slots are always rendered as fragments
  // A vapor client cannot tell slot content from a fallback once either is in
  // the DOM, and has to before it renders any: `<!--(-->` is a fallback, with
  // none of the content's output left. Only said of an outlet that vapor
  // hydrates, or that dropped a vapor slot for its fallback.
  let close = `<!--]-->`
  const before = vaporSlots
  // the component this outlet is written in: a forwarded outlet renders in the
  // slot of another one, which is what `parentComponent` is then
  const owner = getCurrentInstance()
  ssrRenderSlotInner(
    slots,
    slotName,
    slotProps,
    fallbackRenderFn,
    push,
    parentComponent,
    slotScopeId,
    false,
    fallback => {
      if (fallback && (isVapor(owner) || vaporSlots !== before)) {
        push(`<!--(-->`)
        close = `<!--)-->`
      } else {
        push(`<!--[-->`)
      }
    },
  )
  push(close)
}

// slots written in a vapor component that were rendered so far: an outlet in
// a vdom component reads it around its slot to learn that it holds one
let vaporSlots = 0

const isVapor = (instance: ComponentInternalInstance | null): boolean =>
  !!(instance && instance.type.__vapor)

export function ssrRenderSlotInner(
  slots: Slots | SSRSlots,
  slotName: string,
  slotProps: Props | null | undefined,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
  transition?: boolean,
  // called once, before anything is pushed, with whether it is the fallback
  open?: (fallback: boolean) => void,
): void {
  const slotFn = slots[slotName]
  if (slotFn) {
    // a slot is written in the component that rendered the one its outlet is
    // written in
    const owner = getCurrentInstance()
    if (owner && isVapor(owner.vnode.ctx)) vaporSlots++
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
      if (open) open(!validSlotContent && !!fallbackRenderFn)
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
      if (open) open(isEmptySlot && !!fallbackRenderFn)
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
          (slotBuffer[0] === '<!--[-->' || slotBuffer[0] === '<!--(-->') &&
          (slotBuffer[end - 1] === '<!--]-->' ||
            slotBuffer[end - 1] === '<!--)-->')
        ) {
          start++
          end--
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
    if (open) open(!!fallbackRenderFn)
    if (fallbackRenderFn) {
      fallbackRenderFn()
    } else if (transition) {
      push(`<!---->`)
    }
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
