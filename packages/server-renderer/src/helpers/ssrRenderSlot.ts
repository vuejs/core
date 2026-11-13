import {
  type ComponentInternalInstance,
  Fragment,
  type Slots,
  Static,
  type VNode,
  type VNodeArrayChildren,
  cloneVNode,
  isVNode,
  ssrUtils,
} from '@vue/runtime-dom'
import {
  type Props,
  type PushFn,
  type SSRBuffer,
  type SSRBufferItem,
  renderVNodeChildren,
} from '../render'
import { ShapeFlags, isArray, isString } from '@vue/shared'
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
  // take the vars off the props before the slot function sees them: the
  // props object is also what `v-slot` binds, and forwarding it to a nested
  // slot (`v-bind="p"`) must not hand it the vars a second time
  const cssVars = slotCssVars(slotProps)
  if (cssVars) {
    slotCssVarsMap.delete(slotProps as Props)
  }
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
          applySlotCssVars(validSlotContent, cssVars),
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
          const style = cssVars && ssrRenderStyleFrom(cssVars)
          if (style) {
            const state: CssVarsHtmlState = { style, depth: 0 }
            for (let i = start; i < end; i++) {
              push(applySlotCssVarsToBuffer(slotBuffer[i], state))
            }
          } else {
            for (let i = start; i < end; i++) {
              push(slotBuffer[i])
            }
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
// content that actually renders. Keyed on the props object itself rather than
// exposed on it: forwarding props into a nested slot (`v-bind="p"`) must not
// carry the vars along, or they would be applied a second time.
const slotCssVarsMap = new WeakMap<Props, Props>()

export function ssrWithSlotCssVars(
  props: Props | null | undefined,
  cssVars: Props,
): Props {
  const resolved = props || {}
  slotCssVarsMap.set(resolved, cssVars)
  return resolved
}

function slotCssVars(props: Props | null | undefined): Props | undefined {
  return props ? slotCssVarsMap.get(props) : undefined
}

// Render-function slot content is already vnodes. Clone the roots so the vars
// land on the same nodes the client sets them on: element and component roots,
// the children of a root fragment, suspense branches, teleported content and
// hoisted static blocks. Children of a root element stay untouched, same as
// `setVarsOnVNode` does on the client.
function applySlotCssVars(
  vnodes: VNodeArrayChildren,
  cssVars: Props | undefined,
): VNodeArrayChildren {
  return cssVars ? mapSlotRoots(vnodes, cssVars) : vnodes
}

function mapSlotRoots(
  vnodes: VNodeArrayChildren,
  cssVars: Props,
): VNodeArrayChildren {
  let changed = false
  const mapped = vnodes.map(child => {
    if (!isVNode(child)) {
      return child
    }
    const next = withCssVars(child, cssVars)
    if (next !== child) {
      changed = true
    }
    return next
  })
  return changed ? (mapped as VNodeArrayChildren) : vnodes
}

function withCssVars(vnode: VNode, cssVars: Props): VNode {
  const { shapeFlag } = vnode

  if (shapeFlag & ShapeFlags.SUSPENSE) {
    // the client drills into the branch suspense rendered
    if (!vnode.ssContent) {
      return vnode
    }
    const cloned = cloneVNode(vnode)
    cloned.ssContent = withCssVars(vnode.ssContent, cssVars)
    return cloned
  }

  if (shapeFlag & ShapeFlags.TELEPORT) {
    // teleported content replaces the component root at the target
    if (!isArray(vnode.children)) {
      return vnode
    }
    const children = mapSlotRoots(vnode.children as VNodeArrayChildren, cssVars)
    if (children === vnode.children) {
      return vnode
    }
    const cloned = cloneVNode(vnode)
    cloned.children = children
    return cloned
  }

  if (vnode.type === Fragment) {
    if (!isArray(vnode.children)) {
      return vnode
    }
    const children = mapSlotRoots(vnode.children as VNodeArrayChildren, cssVars)
    if (children === vnode.children) {
      return vnode
    }
    const cloned = cloneVNode(vnode)
    cloned.children = children
    return cloned
  }

  if (vnode.type === Static) {
    // the client sets the vars on every element between the static anchors
    const style = ssrRenderStyleFrom(cssVars)
    if (!style || !vnode.children) {
      return vnode
    }
    const children = isArray(vnode.children)
      ? vnode.children.map(child =>
          isString(child)
            ? injectCssVarsIntoHtml(child, { style, depth: 0 })
            : child,
        )
      : isString(vnode.children)
        ? injectCssVarsIntoHtml(vnode.children, { style, depth: 0 })
        : vnode.children
    if (children === vnode.children) {
      return vnode
    }
    const cloned = cloneVNode(vnode)
    cloned.children = children
    return cloned
  }

  if (shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)) {
    return cloneVNode(vnode, cssVars)
  }

  return vnode
}

// Compiled slot content is an HTML buffer. One buffer item is not one node:
// an element's children, a child component's output and its closing tag are
// separate items. The walker therefore carries element depth across items and
// only injects into elements at the top of the slot content, which is exactly
// the set of nodes the client treats as slot roots.
interface CssVarsHtmlState {
  style: string
  depth: number
}

function applySlotCssVarsToBuffer(
  item: SSRBufferItem,
  state: CssVarsHtmlState,
): SSRBufferItem {
  if (isString(item)) {
    return injectCssVarsIntoHtml(item, state)
  }
  if (isArray(item)) {
    // inside an open element nothing in here is a slot root
    if (state.depth) {
      return item
    }
    const mapped = item.map(child => applySlotCssVarsToBuffer(child, state))
    if (item.hasAsync) {
      ;(mapped as SSRBufferItem[] & { hasAsync?: boolean }).hasAsync = true
    }
    return mapped as SSRBufferItem
  }
  // async output is balanced, so walk it with a snapshot of the depth at the
  // time it was pushed: later items advance the shared state, and the promise
  // may resolve after that
  const snapshot: CssVarsHtmlState = { ...state }
  return item.then(
    buffer => applySlotCssVarsToBuffer(buffer, snapshot) as SSRBuffer,
  )
}

function injectCssVarsIntoHtml(html: string, state: CssVarsHtmlState): string {
  if (!state.style) {
    return html
  }
  let result = ''
  let cursor = 0
  while (cursor < html.length) {
    const open = html.indexOf('<', cursor)
    if (open === -1) {
      result += html.slice(cursor)
      break
    }
    result += html.slice(cursor, open)

    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open + 4)
      if (end === -1) {
        result += html.slice(open)
        break
      }
      result += html.slice(open, end + 3)
      cursor = end + 3
      continue
    }

    // `ssrRenderAttrs` escapes `>` in attribute values, so the first `>`
    // closes the tag
    const end = html.indexOf('>', open)
    if (end === -1) {
      result += html.slice(open)
      break
    }
    const tag = html.slice(open, end + 1)

    if (tag[1] === '/') {
      if (state.depth > 0) {
        state.depth--
      }
      result += tag
      cursor = end + 1
      continue
    }

    const name = /^<([^\s/>]+)/.exec(tag)
    if (!name) {
      result += tag
      cursor = end + 1
      continue
    }
    const tagName = name[1]
    const selfClosing = tag[tag.length - 2] === '/'
    result +=
      state.depth === 0
        ? mergeStyleAttr(tag.slice(0, -1), state.style) + '>'
        : tag
    if (!selfClosing && !voidHtmlTags.has(tagName.toLowerCase())) {
      state.depth++
    }
    cursor = end + 1
  }
  return result
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
