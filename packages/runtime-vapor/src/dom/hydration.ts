import { warn } from '@vue/runtime-dom'
import {
  type ChildItem,
  getHydrationContext,
  insertionAnchor,
  insertionParent,
  resetInsertionState,
  setInsertionState,
} from '../insertionState'
import {
  createTextNode,
  disableHydrationNodeLookup,
  enableHydrationNodeLookup,
} from './node'

const isHydratingStack = [] as boolean[]
export let isHydrating = false
export let currentHydrationNode: Node | null = null

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
    ;(Node.prototype as any).$lbn = undefined
    isOptimized = true
  }
  enableHydrationNodeLookup()
  isHydratingStack.push((isHydrating = true))
  setup()
  const res = fn()
  cleanup()
  currentHydrationNode = null
  isHydratingStack.pop()
  isHydrating = isHydratingStack[isHydratingStack.length - 1] || false
  if (!isHydrating) disableHydrationNodeLookup()
  return res
}

export function withHydration(container: ParentNode, fn: () => void): void {
  const setup = () => setInsertionState(container)
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

export function setCurrentHydrationNode(node: Node | null): void {
  currentHydrationNode = node
}

function locateNextSiblingOfParent(n: Node): Node | null {
  if (!n.parentNode) return null
  return n.parentNode.nextSibling || locateNextSiblingOfParent(n.parentNode)
}

export function advanceHydrationNode(
  node: Node & { $pns?: Node | null },
): void {
  // if no next sibling, find the next node in the parent chain
  const ret =
    node.nextSibling ||
    // pns is short for "parent next sibling"
    node.$pns ||
    (node.$pns = locateNextSiblingOfParent(node))
  if (ret) setCurrentHydrationNode(ret)
}

/**
 * Locate the first non-fragment-comment node and locate the next node
 * while handling potential fragments.
 */
function adoptTemplateImpl(node: Node, template: string): Node | null {
  if (!(template[0] === '<' && template[1] === '!')) {
    while (node.nodeType === 8) {
      node = node.nextSibling!

      // empty text node in slot
      if (
        template.trim() === '' &&
        isComment(node, ']') &&
        isComment(node.previousSibling!, '[')
      ) {
        node = node.parentNode!.insertBefore(createTextNode(' '), node)
        break
      }
    }
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

function locateHydrationNodeImpl(): void {
  let node: Node | null
  if (insertionAnchor !== undefined) {
    const hydrationContext = getHydrationContext(insertionParent!)!
    const { prevDynamicCount, children, lastAppendNode, insertAnchors } =
      hydrationContext
    // prepend
    if (insertionAnchor === 0) {
      node = children[prevDynamicCount]
    }
    // insert
    else if (insertionAnchor instanceof Node) {
      const seen = (insertAnchors && insertAnchors.get(insertionAnchor)) || 0
      if (seen) {
        node = children[children.indexOf(insertionAnchor as ChildItem) + seen]
      } else {
        node = insertionAnchor
      }

      hydrationContext.insertAnchors = (
        hydrationContext.insertAnchors || new Map()
      ).set(insertionAnchor, seen + 1)
    }
    // append
    else {
      if (lastAppendNode) {
        node = children[children.indexOf(lastAppendNode as ChildItem) + 1]
      } else {
        if (insertionAnchor === null) {
          node = children[0]
        } else {
          node = children[prevDynamicCount + insertionAnchor]
        }
      }
      hydrationContext.lastAppendNode = node
    }
    hydrationContext.prevDynamicCount++
  } else {
    node = currentHydrationNode
    if (insertionParent && (!node || node.parentNode !== insertionParent)) {
      node = insertionParent.firstChild
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

export function locateFragmentAnchor(
  node: Node,
  label: string,
): Comment | null {
  while (node && node.nodeType === 8) {
    if (isComment(node, label)) return node
    node = node.nextSibling!
  }
  return null
}
