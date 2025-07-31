import { warn } from '@vue/runtime-dom'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
  setInsertionState,
} from '../insertionState'
import {
  __next,
  __nthChild,
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

export function advanceHydrationNode(node: Node): void {
  setCurrentHydrationNode(
    node.nextSibling || (node.parentNode ? node.parentNode.nextSibling : null),
  )
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
    ;(Node.prototype as any).$np = undefined
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
export let locateHydrationNode: (isFragment?: boolean) => void

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

  advanceHydrationNode(node)
  return node
}

const childToHydrateMap = new WeakMap<ParentNode, Node>()

export function updateNextChildToHydrate(parent: ParentNode): void {
  let nextNode = childToHydrateMap.get(parent)
  if (nextNode) {
    nextNode = __next(nextNode)
    if (nextNode) {
      childToHydrateMap.set(parent, (currentHydrationNode = nextNode))
    }
  }
}

function locateHydrationNodeImpl(isFragment?: boolean): void {
  let node: Node | null
  // prepend / firstChild
  if (insertionAnchor === 0) {
    const n = insertionParent!.$np || 0
    node = __nthChild(insertionParent!, n)
    insertionParent!.$np = n + 1
  } else if (insertionAnchor) {
    // `insertionAnchor` is a Node, it is the DOM node to hydrate
    // Template:   `...<span/><!----><span/>...`// `insertionAnchor` is the placeholder
    // SSR Output: `...<span/>Content<span/>...`// `insertionAnchor` is the actual node
    node = insertionAnchor
  } else {
    node = currentHydrationNode
    if (insertionParent && (!node || node.parentNode !== insertionParent)) {
      node =
        childToHydrateMap.get(insertionParent) ||
        _nthChild(insertionParent, insertionParent.$dp || 0)
    }

    // locate slot fragment start anchor
    // if (isFragment && node && !isComment(node, '[')) {
    //   node = locateVaporFragmentAnchor(node, '[')!
    // } else {
    //   while (node && isNonHydrationNode(node)) {
    //     node = node.nextSibling!
    //   }
    // }

    if (insertionParent && node) {
      const nextNode = node.nextSibling
      if (nextNode) childToHydrateMap.set(insertionParent, nextNode)
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
): Comment | null {
  while (node) {
    if (isComment(node, anchorLabel)) return node
    node = node.nextSibling!
  }
  return null
}

export function isEmptyTextNode(node: Node): node is Text {
  return node.nodeType === 3 && !(node as Text).data.trim()
}
