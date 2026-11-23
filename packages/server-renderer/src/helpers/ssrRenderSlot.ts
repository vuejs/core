import {
  type ComponentInternalInstance,
  type Slots,
  type VNodeArrayChildren,
  getCurrentInstance,
  ssrUtils,
} from '@vue/runtime-dom'
import {
  type Props,
  type PushFn,
  type SSRBufferItem,
  isVaporSlotContent,
  renderVNodeChildren,
} from '../render'
import { isArray, isHydrationRangeStart } from '@vue/shared'

const { ensureValidVNode, rawVaporSlotKey } = ssrUtils

// vapor slots rendered so far: an outlet reads it around its slot function to
// learn whether one rendered inside
let vaporSlots = 0

// the slot a transition renders bare, while it renders: a vapor slot that
// opens its range first in it keeps that range
let bare: {
  push: PushFn
  buffer: SSRBufferItem[]
  vapor: boolean
  fallback: boolean
} | null = null

export type SSRSlots = Record<string, SSRSlot>
export type SSRSlot = (
  props: Props,
  push: PushFn,
  parentComponent: ComponentInternalInstance | null,
  scopeId: string | null,
  // a slot of a vapor component: see `ssrRenderSlotInner`
  slotAttrs?: Props,
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
  // a transition renders the slot bare: otherwise it is a range, opened by
  // `<!--[!-->` for the fallback, which a vapor client has to know before it renders
  // anything
  transition?: boolean,
  // what a vdom `cloneVNode` added to the content of a vapor slot, for the
  // slot to render on its root
  slotAttrs?: Props,
): void {
  const slotFn = slots[slotName]
  if (slotFn) {
    // where a transition renders the slot bare: under it, or first in its slot
    let bareSlot = false
    let firstIn: typeof bare = null
    if ((slotFn as any)[rawVaporSlotKey]) {
      vaporSlots++
      if (bare && bare.push === push && !bare.buffer.length) firstIn = bare
      bareSlot = !!transition || !!firstIn
      transition = false
    }
    const before = vaporSlots
    const slotBuffer: SSRBufferItem[] = []
    const bufferedPush = (item: SSRBufferItem) => {
      slotBuffer.push(item)
    }
    const prevBare = bare
    const outlet = (bare = transition
      ? {
          push: bufferedPush,
          buffer: slotBuffer,
          vapor: false,
          fallback: !!fallbackRenderFn,
        }
      : null)
    // A compiled slot disables block tracking unless the outlet that calls it
    // clears `_d`, as `renderSlot` does on the client. A `renderSlot` call in
    // the slot reads the tracking state.
    const compiledSlot = slotFn as { _c?: boolean; _d?: boolean }
    const prev = compiledSlot._d
    if (compiledSlot._c) compiledSlot._d = false
    let ret
    try {
      ret = slotFn(
        // keep the slot function's contract in sync with `renderSlot`, which
        // also normalizes nullish props before invoking the slot
        slotProps || {},
        bufferedPush,
        parentComponent,
        slotScopeId ? ' ' + slotScopeId : '',
        slotAttrs,
      )
    } finally {
      if (compiledSlot._c) compiledSlot._d = prev
    }
    // undefined for an ssr slot; otherwise the vnodes, null for none valid
    let vnodes: VNodeArrayChildren | null | undefined
    if (isArray(ret)) {
      vnodes = ensureValidVNode(ret)
      // a forwarded vapor slot is content whatever it renders: what it does
      // render decides, as for an ssr slot
      if (vnodes && isVaporSlotContent(vnodes)) {
        renderVNodeChildren(bufferedPush, vnodes, parentComponent, slotScopeId)
        vnodes = undefined
      }
    }
    bare = prevBare
    if (vnodes !== undefined) {
      if (!transition) {
        push(!vnodes && fallbackRenderFn ? `<!--[!-->` : `<!--[-->`)
      }
      if (vnodes) {
        // normal slot
        renderVNodeChildren(push, vnodes, parentComponent, slotScopeId)
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
      // A vapor slot renders bare where a transition renders its slot bare,
      // when its first node is not a range: its client takes a range there for
      // the slot's own. Empty, it renders a range where a fallback can show.
      if (
        bareSlot &&
        (!isEmptySlot ||
          (!fallbackRenderFn && !(firstIn && firstIn.fallback))) &&
        opensRange(slotBuffer) === false
      ) {
        for (let i = 0; i < slotBuffer.length; i++) push(slotBuffer[i])
        return
      }
      if (firstIn) firstIn.vapor = true
      if (!transition) {
        push(isEmptySlot && fallbackRenderFn ? `<!--[!-->` : `<!--[-->`)
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
        // nor is the range of a vapor slot rendered first in it
        if (transition && !outlet!.vapor) {
          const first = slotBuffer[0]
          if (
            (first === '<!--[-->' || first === '<!--[!-->') &&
            slotBuffer[end - 1] === '<!--]-->' &&
            spansBuffer(slotBuffer)
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
      push(fallbackRenderFn ? `<!--[!-->` : `<!--[-->`)
    }
    if (fallbackRenderFn) {
      fallbackRenderFn()
    } else if (transition) {
      push(`<!---->`)
    }
  }
  if (!transition) push(`<!--]-->`)
}

// Whether the first node a buffer renders opens a range, undefined when it
// renders none: an async component there may.
function opensRange(buffer: SSRBufferItem[]): boolean | undefined {
  for (let i = 0; i < buffer.length; i++) {
    const item = buffer[i]
    if (isArray(item)) {
      const opens = opensRange(item)
      if (opens !== undefined) return opens
    } else if (typeof item !== 'string') {
      return true
    } else if (item) {
      const match = leadingCommentRE.exec(item)
      return !!match && isHydrationRangeStart(match[1])
    }
  }
}

const leadingCommentRE = /^<!--([^]*?)-->/
const commentTestRE = /^<!--[\s\S]*-->$/
const commentRE = /<!--[^]*?-->/gm
function isComment(item: SSRBufferItem) {
  if (typeof item !== 'string' || !commentTestRE.test(item)) return false
  // if item is '<!---->' or '<!--[-->' or '<!--]-->', return true directly
  if (item.length <= 8) return true
  // a teleport is content, rendered in its target
  if (item.includes('<!--teleport start')) return false
  return !item.replace(commentRE, '').trim()
}

// Whether the range a buffer opens with closes at its end: ranges side by
// side open and close one as well, and every range closes alike. The buffer
// of a component in it holds whole ranges.
function spansBuffer(buffer: SSRBufferItem[]): boolean {
  let depth = 0
  const last = buffer.length - 1
  for (let i = 0; i < last; i++) {
    const item = buffer[i]
    if (typeof item === 'string') {
      let match
      commentRE.lastIndex = 0
      while ((match = commentRE.exec(item))) {
        const data = match[0].slice(4, -3)
        if (isHydrationRangeStart(data)) depth++
        else if (data === ']' && !--depth) return false
      }
    }
  }
  return true
}
