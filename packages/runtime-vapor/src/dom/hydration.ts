import { MismatchTypes, isMismatchAllowed, warn } from '@vue/runtime-dom'
import {
  type ChildItem,
  incrementIndexOffset,
  insertionAnchor,
  insertionParent,
  resetInsertionState,
  setInsertionState,
} from '../insertionState'
import {
  _next,
  child,
  createElement,
  createTextNode,
  disableHydrationNodeLookup,
  enableHydrationNodeLookup,
  parentNode,
} from './node'
import { remove } from '../block'

const isHydratingStack = [] as boolean[]
export let isHydrating = false
export let currentHydrationNode: Node | null = null

export function runWithNonHydrating(fn: () => any): any {
  try {
    isHydrating = false
    return fn()
  } finally {
    isHydrating = true
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
    ;(Node.prototype as any).$uc = undefined
    ;(Node.prototype as any).$idx = undefined
    ;(Node.prototype as any).$children = undefined
    ;(Node.prototype as any).$idxMap = undefined
    ;(Node.prototype as any).$prevDynamicCount = undefined
    ;(Node.prototype as any).$anchorCount = undefined
    ;(Node.prototype as any).$appendIndex = undefined
    ;(Node.prototype as any).$indexOffset = undefined

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
        const parent = parentNode(node)!
        node = parent.insertBefore(createTextNode(), node)
        incrementIndexOffset(parent)
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
  let idxMap: number[] | undefined
  if (insertionAnchor !== undefined && (idxMap = insertionParent!.$idxMap)) {
    const {
      $prevDynamicCount: prevDynamicCount = 0,
      $appendIndex: appendIndex,
      $indexOffset: indexOffset = 0,
      $anchorCount: anchorCount = 0,
    } = insertionParent!
    // prepend
    if (insertionAnchor === 0) {
      // use prevDynamicCount as logical index to locate the hydration node
      const realIndex = idxMap![prevDynamicCount] + indexOffset
      node = insertionParent!.childNodes[realIndex]
    }
    // insert
    else if (insertionAnchor instanceof Node) {
      // handling insertion anchors:
      // 1. first encounter: use insertionAnchor itself as the hydration node
      // 2. subsequent: use node following the insertionAnchor as the hydration node
      // used count tracks how many times insertionAnchor has been used, ensuring
      // consecutive insert operations locate the correct hydration node.
      let { $idx, $uc: usedCount } = insertionAnchor as ChildItem
      if (usedCount !== undefined) {
        const realIndex = idxMap![$idx + usedCount + 1] + indexOffset
        node = insertionParent!.childNodes[realIndex]
        usedCount++
      } else {
        node = insertionAnchor
        // first use of this anchor: it doesn't consume the next child
        // so we track unique anchor appearances for later offset correction
        insertionParent!.$anchorCount = anchorCount + 1
        usedCount = 0
      }
      ;(insertionAnchor as ChildItem).$uc = usedCount
    }
    // append
    else {
      let realIndex: number
      if (appendIndex !== null && appendIndex !== undefined) {
        realIndex = idxMap![appendIndex + 1] + indexOffset
        node = insertionParent!.childNodes[realIndex]
      } else {
        if (insertionAnchor === null) {
          // insertionAnchor is null, indicates no previous static nodes
          // use the first child as hydration node
          realIndex = idxMap![0] + indexOffset
          node = insertionParent!.childNodes[realIndex]
        } else {
          // insertionAnchor is a number > 0
          // indicates how many static nodes precede the node to append
          // use it as index to locate the hydration node
          realIndex = idxMap![prevDynamicCount + insertionAnchor] + indexOffset
          node = insertionParent!.childNodes[realIndex]
        }
      }
      insertionParent!.$appendIndex = (node as ChildItem).$idx
    }

    insertionParent!.$prevDynamicCount = prevDynamicCount + 1
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
    const end = locateEndAnchor(node as Anchor)
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
