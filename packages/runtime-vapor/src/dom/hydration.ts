import { MismatchTypes, isMismatchAllowed, warn } from '@vue/runtime-dom'
import {
  type ChildItem,
  insertionAnchor,
  insertionParent,
  resetInsertionState,
  setInsertionState,
} from '../insertionState'
import {
  _child,
  _next,
  createElement,
  createTextNode,
  disableHydrationNodeLookup,
  enableHydrationNodeLookup,
  locateChildByLogicalIndex,
  parentNode,
} from './node'
import { remove } from '../block'

const isHydratingStack = [] as boolean[]
export let isHydrating = false
export let currentHydrationNode: Node | null = null

function pushIsHydrating(value: boolean): void {
  isHydratingStack.push((isHydrating = value))
}

function popIsHydrating(): void {
  isHydratingStack.pop()
  isHydrating = isHydratingStack[isHydratingStack.length - 1] || false
}

export function runWithoutHydration(fn: () => any): any {
  try {
    pushIsHydrating(false)
    return fn()
  } finally {
    popIsHydrating()
  }
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
    ;(Node.prototype as any).$pns = undefined
    ;(Node.prototype as any).$idx = undefined
    ;(Node.prototype as any).$llc = undefined
    ;(Node.prototype as any).$lpn = undefined
    ;(Node.prototype as any).$lan = undefined
    ;(Node.prototype as any).$lin = undefined
    ;(Node.prototype as any).$curIdx = undefined

    isOptimized = true
  }
  enableHydrationNodeLookup()
  pushIsHydrating(true)
  setup()
  const res = fn()
  cleanup()
  currentHydrationNode = null
  popIsHydrating()
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
        node.before((node = createTextNode()))
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

  currentHydrationNode = node.nextSibling
  return node
}

export function locateNextNode(node: Node): Node | null {
  return isComment(node, '[')
    ? _next(locateEndAnchor(node)!)
    : isComment(node, 'teleport start')
      ? _next(locateEndAnchor(node, 'teleport start', 'teleport end')!)
      : _next(node)
}

function locateHydrationNodeImpl(): void {
  let node: Node | null
  if (insertionAnchor !== undefined) {
    const { $lpn: lastPrepend, $lan: lastAppend, firstChild } = insertionParent!
    // prepend
    if (insertionAnchor === 0) {
      node = insertionParent!.$lpn = lastPrepend
        ? locateNextNode(lastPrepend)
        : firstChild
    }
    // insert
    else if (insertionAnchor instanceof Node) {
      const { $lin: lastInsertedNode } = insertionAnchor as ChildItem
      node = (insertionAnchor as ChildItem).$lin = lastInsertedNode
        ? locateNextNode(lastInsertedNode)
        : insertionAnchor
    }
    // append
    else {
      node = insertionParent!.$lan = lastAppend
        ? locateNextNode(lastAppend)
        : insertionAnchor === null
          ? firstChild
          : locateChildByLogicalIndex(insertionParent!, insertionAnchor)!
    }

    insertionParent!.$llc = node
    ;(node as ChildItem).$idx = insertionParent!.$curIdx =
      insertionParent!.$curIdx === undefined ? 0 : insertionParent!.$curIdx + 1
  } else {
    node = currentHydrationNode
    if (insertionParent && (!node || node.parentNode !== insertionParent)) {
      node = insertionParent.firstChild
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
export function locateFragmentEndAnchor(label: string = ']'): Comment | null {
  let node = currentHydrationNode!
  while (node) {
    if (isComment(node, label)) return node
    node = node.nextSibling!
  }
  return null
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

  // fragment
  if (isComment(node, '[')) {
    removeFragmentNodes(node)
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
  const newNode = _child(t.content).cloneNode(true) as Element
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

export function removeFragmentNodes(node: Node, endAnchor?: Node): void {
  const end = endAnchor || locateEndAnchor(node as Anchor)
  while (true) {
    const next = _next(node)
    if (next && next !== end) {
      remove(next, parentNode(node)!)
    } else {
      break
    }
  }
}
