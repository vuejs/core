import {
  MismatchTypes,
  isMismatchAllowed,
  isHydrating as isVdomHydrating,
  warn,
} from '@vue/runtime-dom'
import {
  insertionIndex,
  insertionParent,
  resetInsertionState,
  setInsertionState,
} from '../insertionState'
import {
  _child,
  _next,
  createElement,
  createTextNode,
  locateChildByLogicalIndex,
  parentNode,
} from './node'
import { remove } from '../block'

export let isHydratingEnabled = false

export function setIsHydratingEnabled(value: boolean): void {
  isHydratingEnabled = value
}

export let currentHydrationNode: Node | null = null

export let isHydrating = false
function setIsHydrating(value: boolean) {
  if (!isHydratingEnabled && !isVdomHydrating) return false
  try {
    return isHydrating
  } finally {
    isHydrating = value
  }
}

export function runWithoutHydration(fn: () => any): any {
  const prev = setIsHydrating(false)
  try {
    return fn()
  } finally {
    setIsHydrating(prev)
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
    ;(Node.prototype as any).$idx = undefined
    ;(Node.prototype as any).$llc = undefined
    ;(Node.prototype as any).$vha = undefined

    isOptimized = true
  }
  const prev = setIsHydrating(true)
  const prevHydrationNode = currentHydrationNode
  currentHydrationNode = null
  try {
    setup()
    return fn()
  } finally {
    cleanup()
    currentHydrationNode = prevHydrationNode
    setIsHydrating(prev)
  }
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

export function enterHydration(node: Node): () => void {
  const prevHydrationEnabled = isHydratingEnabled
  if (!prevHydrationEnabled) {
    setIsHydratingEnabled(true)
  }

  const prev = setIsHydrating(true)
  const prevHydrationNode = currentHydrationNode
  currentHydrationNode = node

  return () => {
    currentHydrationNode = prevHydrationNode
    setIsHydrating(prev)
    if (!prevHydrationEnabled) {
      setIsHydratingEnabled(false)
    }
  }
}

export let adoptTemplate: (node: Node, template: string) => Node | null
export let locateHydrationNode: (consumeFragmentStart?: boolean) => void

type Anchor = Comment & {
  // reused hydration anchors must stay in place during mismatch recovery
  $vha?: 1

  // cached matching fragment end to avoid repeated traversal
  // on nested fragments
  $fe?: Anchor
}

export const isComment = (node: Node, data: string): node is Anchor =>
  node.nodeType === 8 && (node as Comment).data === data

export function setCurrentHydrationNode(node: Node | null): void {
  currentHydrationNode = node
}

/* @__NO_SIDE_EFFECTS__ */
function locateNextSiblingOfParent(n: Node): Node | null {
  if (!n.parentNode) return null
  return _next(n.parentNode) || locateNextSiblingOfParent(n.parentNode)
}

export function advanceHydrationNode(node: Node): void {
  // if no next sibling, find the next node in the parent chain
  const ret = _next(node) || locateNextSiblingOfParent(node)
  if (ret) setCurrentHydrationNode(ret)
}

/**
 * Locate the first non-fragment-comment node and locate the next node
 * while handling potential fragments.
 */
function adoptTemplateImpl(node: Node, template: string): Node | null {
  if (!(template[0] === '<' && template[1] === '!')) {
    // empty text node in slot
    if (
      template.trim() === '' &&
      isComment(node, ']') &&
      isComment(node.previousSibling!, '[')
    ) {
      node.before((node = createTextNode()))
    }

    node = resolveHydrationTarget(node)
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

export function locateNextNode(node: Node): Node | null {
  return isComment(node, '[')
    ? _next(locateEndAnchor(node)!)
    : isComment(node, 'teleport start')
      ? _next(locateEndAnchor(node, 'teleport start', 'teleport end')!)
      : _next(node)
}

function locateHydrationNodeImpl(consumeFragmentStart = false) {
  let node: Node | null

  if (insertionIndex !== undefined) {
    // use logicalIndex to locate the node
    node = locateChildByLogicalIndex(insertionParent!, insertionIndex)
  } else if (insertionParent) {
    // no logicalIndex: withHydration entry initialization
    node = insertionParent.firstChild
  } else {
    node = currentHydrationNode
  }

  // consume fragment start anchor if needed
  if (consumeFragmentStart && node && isComment(node, '[')) {
    node = node.nextSibling
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

// Find the SSR close marker for the current owner.
export function locateHydrationBoundaryClose(
  node: Node,
  closeHint: Node | null = null,
): Node {
  let close = closeHint
  if (!close || !isComment(close, ']')) {
    if (isComment(node, ']')) {
      close = node
    } else {
      let candidate = locateNextNode(node)
      while (candidate && !isComment(candidate, ']')) {
        candidate = locateNextNode(candidate)
      }
      close = candidate
    }
  }

  if (!close) {
    return node
  }

  return close
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

  const container = parentNode(node)!
  const shouldPreserveAnchor = isHydrationAnchor(node)
  const next = shouldPreserveAnchor ? node : _next(node)
  if (!shouldPreserveAnchor) {
    remove(node, container)
  }

  // fast path for text nodes
  if (template[0] !== '<') {
    return container.insertBefore(createTextNode(template), next)
  }

  // element node
  const t = createElement('template') as HTMLTemplateElement
  t.innerHTML = template
  const newNode = _child(t.content).cloneNode(true) as Element
  if (node.nodeType === 1) {
    newNode.innerHTML = (node as Element).innerHTML
    Array.from((node as Element).attributes).forEach(attr => {
      newNode.setAttribute(attr.name, attr.value)
    })
  }
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
  const parent = parentNode(node)
  if (!parent) {
    return
  }
  const end = endAnchor || locateEndAnchor(node as Anchor)
  while (true) {
    const next = _next(node)
    if (next && next !== end) {
      remove(next, parent)
    } else {
      break
    }
  }
}

function removeHydrationNode(node: Node, close: Node | null = null): void {
  const parent = parentNode(node)
  if (!parent) {
    return
  }

  if (isComment(node, '[')) {
    const end = locateEndAnchor(node)
    removeFragmentNodes(node, end || undefined)
    const endParent = end && parentNode(end)
    if (end && end !== close && endParent) {
      remove(end, endParent)
    }
  } else if (isComment(node, 'teleport start')) {
    const end = locateEndAnchor(node, 'teleport start', 'teleport end')
    removeFragmentNodes(node, end || undefined)
    const endParent = end && parentNode(end)
    if (end && end !== close && endParent) {
      remove(end, endParent)
    }
  }

  remove(node, parent)
}

export function cleanupHydrationTail(node: Node): void {
  const container = node.parentElement
  if (container) {
    warnHydrationChildrenMismatch(container)
  }
  removeHydrationNode(node)
}

export function markHydrationAnchor<T extends Node>(node: T): T {
  ;(node as any).$vha = 1
  return node
}

export function isHydrationAnchor(node: Node | null | undefined): boolean {
  return !!node && (node as Anchor).$vha === 1
}

function resolveHydrationTarget(node: Node): Node {
  while (true) {
    if (isHydrationAnchor(node)) {
      return node
    }

    if (
      node.nodeType === 8 &&
      ((node as Comment).data === '[' ||
        (node as Comment).data === ']' ||
        (node as Comment).data === 'teleport start' ||
        (node as Comment).data === 'teleport end')
    ) {
      const next = node.nextSibling
      if (!next) return node
      node = next
      continue
    }

    return node
  }
}

function finalizeHydrationBoundary(close: Node | null): void {
  let node = currentHydrationNode

  // Once the hydration cursor has already reached `close`, this scope has no
  // unclaimed SSR nodes left to trim. Single-root paths commonly end up here,
  // so there is no children-count mismatch to report for this boundary.
  if (!close || !node || node === close) {
    return
  }

  // This boundary only owns cleanup while the current cursor is still inside
  // its SSR range. If nested hydration has already advanced past `close`, stop
  // here so we don't delete sibling or parent-owned SSR nodes by mistake.
  let cur: Node | null = node
  let hasRemovableNode = false
  while (cur && cur !== close) {
    if (!isHydrationAnchor(cur)) {
      hasRemovableNode = true
    }
    cur = locateNextNode(cur)
  }
  if (!cur) return
  if (!hasRemovableNode) {
    setCurrentHydrationNode(close)
    return
  }

  warnHydrationChildrenMismatch((close as Node).parentElement)

  while (node && node !== close) {
    const next = locateNextNode(node)
    if (!isHydrationAnchor(node)) {
      removeHydrationNode(node, close)
    }
    node = next!
  }

  setCurrentHydrationNode(close)
}

function warnHydrationChildrenMismatch(container: Element | null): void {
  if (container && !isMismatchAllowed(container, MismatchTypes.CHILDREN)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      warn(
        `Hydration children mismatch on`,
        container,
        `\nServer rendered element contains more child nodes than client nodes.`,
      )
    logMismatchError()
  }
}

export function enterHydrationBoundary(close: Node | null): () => void {
  return () => {
    finalizeHydrationBoundary(close)
  }
}
