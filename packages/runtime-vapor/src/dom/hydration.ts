import { MismatchTypes, isMismatchAllowed, warn } from '@vue/runtime-dom'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
  setInsertionState,
} from '../insertionState'
import {
  _child,
  _next,
  child,
  createElement,
  createTextNode,
  disableHydrationNodeLookup,
  enableHydrationNodeLookup,
  parentNode,
} from './node'
import { BLOCK_ANCHOR_END_LABEL, BLOCK_ANCHOR_START_LABEL } from '@vue/shared'
import { remove } from '../block'

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
    _next(node) ||
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
      node = _next(node)

      // empty text node in slot
      if (
        template.trim() === '' &&
        isComment(node, ']') &&
        isComment(node.previousSibling!, '[')
      ) {
        node = parentNode(node)!.insertBefore(createTextNode(), node)
        break
      }
    }
  }

  const type = node.nodeType
  if (
    // comment node
    (type === 8 && !template.startsWith('<!')) ||
    // element node
    (type === 1 &&
      !template.startsWith(`<` + (node as Element).tagName.toLowerCase()))
  ) {
    node = handleMismatch(node, template)
  }

  advanceHydrationNode(node)
  return node
}

function locateHydrationNodeImpl(): void {
  let node: Node | null
  if (insertionAnchor !== undefined) {
    // prepend / insert / append
    node = insertionParent!.$lbn = locateNextBlockNode(
      insertionParent!.$lbn || _child(insertionParent!),
    )!
  } else {
    node = currentHydrationNode
    if (insertionParent && (!node || parentNode(node) !== insertionParent)) {
      node = _child(insertionParent)
    }
  }

  if (__DEV__ && !node) {
    throw new Error(
      `No current hydration node was found.\n` +
        `this is likely a Vue internal bug.`,
    )
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
  while ((node = _next(node) as Anchor) && stack.length > 0) {
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
    if ((node as Comment).data === label) return node as Comment
    node = _next(node)
  }

  if (__DEV__) {
    throw new Error(
      `Could not locate fragment anchor node with label: ${label}\n` +
        `this is likely a Vue internal bug.`,
    )
  }

  return null
}

function locateNextBlockNode(node: Node): Node | null {
  while (node) {
    if (isComment(node, BLOCK_ANCHOR_START_LABEL)) return _next(node)
    node = _next(node)
  }

  if (__DEV__) {
    throw new Error(
      `Could not locate hydration node with anchor label: ${BLOCK_ANCHOR_START_LABEL}\n` +
        `this is likely a Vue internal bug.`,
    )
  }
  return null
}

export function advanceToNonBlockNode(node: Node): Node {
  while (node) {
    if (isComment(node, BLOCK_ANCHOR_START_LABEL)) {
      node = locateEndAnchor(
        node,
        BLOCK_ANCHOR_START_LABEL,
        BLOCK_ANCHOR_END_LABEL,
      )!
      continue
    }

    break
  }
  return node
}

function handleMismatch(node: Node, template: string): Node {
  if (!isMismatchAllowed(node.parentElement!, MismatchTypes.CHILDREN)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      warn(
        `Hydration node mismatch:\n- rendered on server:`,
        node,
        node.nodeType === 3
          ? `(text)`
          : isComment(node, '[[')
            ? `(start of block node)`
            : ``,
        `\n- expected on client:`,
        template,
      )
    logMismatchError()
  }

  // block node start
  if (isComment(node, BLOCK_ANCHOR_START_LABEL)) {
    const end = locateEndAnchor(
      node as Anchor,
      BLOCK_ANCHOR_START_LABEL,
      BLOCK_ANCHOR_END_LABEL,
    )
    while (true) {
      const next = _next(node)
      if (next && next !== end) {
        remove(next, parentNode(node)!)
      } else {
        break
      }
    }
  }

  const next = _next(node)
  const container = parentNode(node)!
  remove(node, container)

  // fast path for text nodes
  if (template[0] !== '<') {
    return container.insertBefore(createTextNode(template), next)
  }

  // element node
  const t = createElement('template') as HTMLTemplateElement
  t.innerHTML = template
  const newNode = child(t.content).cloneNode(true) as Element
  newNode.innerHTML = (node as Element).innerHTML
  Array.from((node as Element).attributes).forEach(attr => {
    newNode.setAttribute(attr.name, attr.value)
  })
  container.insertBefore(newNode, next)
  return newNode
}

let hasLoggedMismatchError = false
export const logMismatchError = (): void => {
  if (__TEST__ || hasLoggedMismatchError) {
    return
  }
  // this error should show up in production
  console.error('Hydration completed but contains mismatches.')
  hasLoggedMismatchError = true
}
