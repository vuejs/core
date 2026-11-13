import {
  type ComponentInternalInstance,
  Fragment,
  type Slots,
  type VNode,
  type VNodeArrayChildren,
  cloneVNode,
  isVNode,
  ssrUtils,
} from '@vue/runtime-dom'
import {
  type Props,
  type PushFn,
  type SSRBufferItem,
  renderVNodeChildren,
} from '../render'
import { ShapeFlags, isArray, isPromise, isString } from '@vue/shared'
import { ssrRenderStyle } from './ssrRenderAttrs'

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
  slotProps: Props | null | undefined,
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
      // keep the slot function's contract in sync with `renderSlot`, which also
      // normalizes nullish props before invoking the slot
      slotProps || {},
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
          applySlotCssVars(validSlotContent, slotProps),
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

        if (start < end) {
          for (let i = start; i < end; i++) {
            push(applySlotCssVarsToSSR(slotBuffer[i], slotProps))
          }
        } else if (transition) {
          push(`<!---->`)
        }
      }
    }
  } else if (fallbackRenderFn) {
    fallbackRenderFn()
  } else if (transition) {
    push(`<!---->`)
  }
}

// Mark compiled slot props so css vars bound to a root `<slot>` reach the
// content that actually renders. A plain props object stays untouched.
export const slotCssVarsKey: unique symbol = Symbol(
  __DEV__ ? `slotCssVars` : ``,
)

export function ssrWithSlotCssVars(
  props: Props | null | undefined,
  cssVars: Props,
): Props {
  return new Proxy((props || {}) as Props, {
    get(target, key, receiver) {
      return key === slotCssVarsKey
        ? cssVars
        : Reflect.get(target, key, receiver)
    },
    has(target, key) {
      return key === slotCssVarsKey || Reflect.has(target, key)
    },
  })
}

function slotCssVars(props: Props | null | undefined): Props | undefined {
  return props ? (props as any)[slotCssVarsKey] : undefined
}

// Render-function slot content is already vnodes. Clone the roots so the
// vars land on the same nodes the client sets them on.
function applySlotCssVars(
  vnodes: VNodeArrayChildren,
  slotProps: Props | null | undefined,
): VNodeArrayChildren {
  const cssVars = slotCssVars(slotProps)
  if (!cssVars) {
    return vnodes
  }
  return vnodes.map(child =>
    isVNode(child) ? withCssVars(child, cssVars) : child,
  ) as VNodeArrayChildren
}

function withCssVars(vnode: VNode, cssVars: Props): VNode {
  if (vnode.type === Fragment && isArray(vnode.children)) {
    const cloned = cloneVNode(vnode)
    cloned.children = (vnode.children as VNodeArrayChildren).map(child =>
      isVNode(child) ? withCssVars(child, cssVars) : child,
    )
    return cloned
  }
  if (vnode.shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)) {
    return cloneVNode(vnode, cssVars)
  }
  return vnode
}

// Compiled slot content is an HTML buffer. Walk its root elements the same
// way the client walks the slot fragment, and merge the vars into each
// element's style.
function applySlotCssVarsToSSR(
  item: SSRBufferItem,
  slotProps: Props | null | undefined,
): SSRBufferItem {
  const cssVars = slotCssVars(slotProps)
  if (!cssVars) {
    return item
  }
  if (isPromise(item)) {
    return item.then(buffer =>
      applySlotCssVarsToSSR(buffer, slotProps),
    ) as Promise<SSRBufferItem & any[]>
  }
  if (isArray(item)) {
    const mapped = item.map(child => applySlotCssVarsToSSR(child, slotProps))
    if (item.hasAsync) {
      ;(mapped as SSRBufferItem[] & { hasAsync?: boolean }).hasAsync = true
    }
    return mapped as SSRBufferItem
  }
  if (!isString(item)) {
    return item
  }
  return injectCssVarsIntoHtml(item, cssVars)
}

function injectCssVarsIntoHtml(html: string, cssVars: Props): string {
  const style = ssrRenderStyleFrom(cssVars)
  if (!style) {
    return html
  }
  let result = ''
  let cursor = 0
  while (cursor < html.length) {
    if (html.startsWith('<!--', cursor)) {
      const end = html.indexOf('-->', cursor)
      if (end === -1) break
      const comment = html.slice(cursor, end + 3)
      result += comment
      cursor = end + 3
      if (comment === '<!--[-->') {
        const close = findFragmentEnd(html, cursor)
        result += injectCssVarsIntoHtml(html.slice(cursor, close), cssVars)
        cursor = close
      }
      continue
    }
    if (html[cursor] !== '<') {
      // text (or the fallback string) can sit beside a root element
      const next = html.indexOf('<', cursor)
      if (next === -1) {
        result += html.slice(cursor)
        cursor = html.length
        break
      }
      result += html.slice(cursor, next)
      cursor = next
      continue
    }
    const nameEnd = html.slice(cursor + 1).search(/[\s>/]/)
    if (nameEnd <= 0) break
    const tag = html.slice(cursor + 1, cursor + 1 + nameEnd)
    if (tag[0] === '/' || tag[0] === '!') break
    const openEnd = html.indexOf('>', cursor)
    if (openEnd === -1) break
    result += mergeStyleAttr(html.slice(cursor, openEnd), style)
    cursor = openEnd
    if (html[openEnd - 1] === '/' || isVoidHtmlTag(tag)) {
      result += '>'
      cursor = openEnd + 1
      continue
    }
    const close = findCloseTag(html, tag, openEnd + 1)
    result += html.slice(openEnd, close)
    cursor = close
  }
  return result + html.slice(cursor)
}

function mergeStyleAttr(openTag: string, style: string): string {
  // `style` is already escaped by ssrRenderStyle, and an existing attribute
  // value is already escaped, so the two can be concatenated as text.
  const match = /\sstyle="([^"]*)"/i.exec(openTag)
  if (!match) {
    return `${openTag} style="${style}"`
  }
  const existing = match[1]
  const merged = existing
    ? existing.endsWith(';')
      ? existing + style
      : `${existing};${style}`
    : style
  return (
    openTag.slice(0, match.index) +
    ` style="${merged}"` +
    openTag.slice(match.index + match[0].length)
  )
}

function findFragmentEnd(html: string, from: number): number {
  let depth = 1
  let cursor = from
  while (cursor < html.length && depth) {
    const start = html.indexOf('<!--[-->', cursor)
    const end = html.indexOf('<!--]-->', cursor)
    if (end === -1) return html.length
    if (start !== -1 && start < end) {
      depth++
      cursor = start + 8
    } else {
      depth--
      cursor = end + 8
    }
  }
  return cursor
}

function findCloseTag(html: string, tag: string, from: number): number {
  const open = new RegExp(`<${tag}(?=[\\s>/])`, 'gi')
  const close = new RegExp(`</${tag}>`, 'gi')
  open.lastIndex = from
  close.lastIndex = from
  let depth = 1
  let nextOpen = open.exec(html)
  let nextClose = close.exec(html)
  while (depth && nextClose) {
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++
      nextOpen = open.exec(html)
    } else {
      depth--
      if (!depth) return nextClose.index + nextClose[0].length
      nextClose = close.exec(html)
    }
  }
  return html.length
}

const voidHtmlTags = /*@__PURE__*/ new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

function isVoidHtmlTag(tag: string): boolean {
  return voidHtmlTags.has(tag.toLowerCase())
}

function ssrRenderStyleFrom(cssVars: Props): string {
  const style = (cssVars as any).style
  return style ? ssrRenderStyle(style) : ''
}

const commentTestRE = /^<!--[\s\S]*-->$/
const commentRE = /<!--[^]*?-->/gm
function isComment(item: SSRBufferItem) {
  if (typeof item !== 'string' || !commentTestRE.test(item)) return false
  // if item is '<!---->' or '<!--[-->' or '<!--]-->', return true directly
  if (item.length <= 8) return true
  return !item.replace(commentRE, '').trim()
}
