import { warn } from '@vue/runtime-dom'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
  setInsertionState,
} from '../insertionState'
import {
  _nthChild,
  disableHydrationNodeLookup,
  enableHydrationNodeLookup,
} from './node'
import { isVaporAnchors } from '@vue/shared'

export let isHydrating = false
export let currentHydrationNode: Node | null = null

export function setCurrentHydrationNode(node: Node | null): void {
  currentHydrationNode = node
}

let isOptimized = false

function performHydration<T>(
  fn: () => T,
  setup: () => void,
  cleanup: () => void,
): T {
  if (!isOptimized) {
    adoptTemplate = adoptTemplateImpl
    locateHydrationNode = locateHydrationNodeImpl

    // optimize anchor cache lookup
    ;(Comment.prototype as any).$fe = undefined
    ;(Node.prototype as any).$dp = undefined
    isOptimized = true
  }
  enableHydrationNodeLookup()
  isHydrating = true
  setup()
  const res = fn()
  cleanup()
  currentHydrationNode = null
  isHydrating = false
  disableHydrationNodeLookup()
  return res
}

export function withHydration(container: ParentNode, fn: () => void): void {
  const setup = () => setInsertionState(container, 0)
  const cleanup = () => resetInsertionState()
  return performHydration(fn, setup, cleanup)
}

export function hydrateNode(node: Node, fn: () => void): void {
  const setup = () => (currentHydrationNode = node)
  const cleanup = () => {}
  return performHydration(fn, setup, cleanup)
}

export let adoptTemplate: (node: Node, template: string) => Node | null
export let locateHydrationNode: () => void

type Anchor = Comment & {
  // cached matching fragment end to avoid repeated traversal
  // on nested fragments
  $fe?: Anchor
}

export const isComment = (node: Node, data: string): node is Anchor =>
  node.nodeType === 8 && (node as Comment).data === data

/**
 * Locate the first non-fragment-comment node and locate the next node
 * while handling potential fragments.
 */
function adoptTemplateImpl(node: Node, template: string): Node | null {
  if (!(template[0] === '<' && template[1] === '!')) {
    while (node.nodeType === 8) node = node.nextSibling!
  }

  if (__DEV__) {
    const type = node.nodeType
    if (
      (type === 8 && !template.startsWith('<!')) ||
      (type === 1 &&
        !template.startsWith(`<` + (node as Element).tagName.toLowerCase())) ||
      (type === 3 &&
        template.trim() &&
        !template.startsWith((node as Text).data))
    ) {
      // TODO recover and provide more info
      warn(`adopted: `, node)
      warn(`template: ${template}`)
      warn('hydration mismatch!')
    }
  }

  currentHydrationNode = node.nextSibling
  return node
}

function locateHydrationNodeImpl() {
  let node: Node | null
  // prepend / firstChild
  if (insertionAnchor === 0) {
    node = insertionParent!.firstChild
  } else if (insertionAnchor) {
    // `insertionAnchor` is a Node, it is the DOM node to hydrate
    // Template:   `...<span/><!----><span/>...`// `insertionAnchor` is the placeholder
    // SSR Output: `...<span/>Content<span/>...`// `insertionAnchor` is the actual node
    node = insertionAnchor
  } else {
    node = currentHydrationNode

    // if current hydration node is not under the current parent, or no
    // current node, find node by dynamic position or use the first child
    if (insertionParent && (!node || node.parentNode !== insertionParent)) {
      node = _nthChild(insertionParent, insertionParent.$dp || 0)
    }

    while (node && isNonHydrationNode(node)) {
      node = node.nextSibling!
    }
  }

  if (__DEV__ && !node) {
    // TODO more info
    warn('Hydration mismatch in ', insertionParent)
  }

  resetInsertionState()
  currentHydrationNode = node
}

export function locateEndAnchor(
  node: Anchor,
  open = '[',
  close = ']',
): Node | null {
  // already cached matching end
  if (node.$fe) {
    return node.$fe
  }

  const stack: Anchor[] = [node]
  while ((node = node.nextSibling as Anchor) && stack.length > 0) {
    if (node.nodeType === 8) {
      if (node.data === open) {
        stack.push(node)
      } else if (node.data === close) {
        const matchingOpen = stack.pop()!
        matchingOpen.$fe = node
        if (stack.length === 0) return node
      }
    }
  }

  return null
}

export function isNonHydrationNode(node: Node): boolean {
  return (
    // empty text node
    isEmptyTextNode(node) ||
    // vdom fragment end anchor (`<!--]-->`)
    isComment(node, ']') ||
    // vapor mode specific anchors
    isVaporAnchors(node)
  )
}

export function locateVaporFragmentAnchor(
  node: Node,
  anchorLabel: string,
): Comment | undefined {
  let n = node.nextSibling
  while (n) {
    if (isComment(n, anchorLabel)) return n
    n = n.nextSibling
  }
}

export function isEmptyTextNode(node: Node): node is Text {
  return node.nodeType === 3 && !(node as Text).data.trim()
}
