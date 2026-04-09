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

export interface HydrationBoundary {
  // Structural close marker the current owner must not cross during cleanup.
  close?: Node | null
  // Marker mismatch recovery must insert before instead of replacing.
  preserve?: Node | null
  // Whether restore should trim unclaimed SSR nodes up to `close`.
  cleanupOnPop?: boolean
}

export let currentHydrationBoundary: HydrationBoundary | null = null

function finalizeHydrationBoundary(boundary: HydrationBoundary): void {
  const close = boundary.close
  let node = currentHydrationNode

  if (!close || !node || node === close || node === boundary.preserve) {
    return
  }

  // This boundary only owns cleanup while the current cursor is still inside
  // its SSR range. If nested hydration has already advanced past `close`, stop
  // here so we don't delete sibling or parent-owned SSR nodes by mistake.
  let cur: Node | null = node
  while (cur && cur !== close) {
    cur = locateNextNode(cur)
  }
  if (!cur) return

  warnHydrationChildrenMismatch((close as Node).parentElement)

  while (node && node !== close) {
    const next = locateNextNode(node)
    removeHydrationNode(node, close)
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

export function pushHydrationBoundary(boundary: HydrationBoundary): () => void {
  const prev = currentHydrationBoundary
  currentHydrationBoundary = boundary
  return () => {
    if (boundary.cleanupOnPop) {
      finalizeHydrationBoundary(boundary)
    }
    currentHydrationBoundary = prev
  }
}

export function patchCurrentHydrationBoundary(
  patch: Partial<HydrationBoundary>,
): void {
  if (currentHydrationBoundary) {
    Object.assign(currentHydrationBoundary, patch)
  }
}

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
  const prevHydrationBoundary = currentHydrationBoundary
  currentHydrationNode = null
  try {
    setup()
    return fn()
  } finally {
    cleanup()
    currentHydrationNode = prevHydrationNode
    currentHydrationBoundary = prevHydrationBoundary
    setIsHydrating(prev)
  }
}

export function withHydration(container: ParentNode, fn: () => void): void {
  const setup = () => {
    setInsertionState(container)
    currentHydrationBoundary = {}
  }
  const cleanup = () => resetInsertionState()
  return performHydration(fn, setup, cleanup)
}

export function hydrateNode(node: Node, fn: () => void): void {
  const setup = () => {
    currentHydrationNode = node
    currentHydrationBoundary = {}
  }
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
  const prevHydrationBoundary = currentHydrationBoundary
  currentHydrationNode = node
  currentHydrationBoundary = {}

  return () => {
    currentHydrationNode = prevHydrationNode
    currentHydrationBoundary = prevHydrationBoundary
    setIsHydrating(prev)
    if (!prevHydrationEnabled) {
      setIsHydratingEnabled(false)
    }
  }
}

export let adoptTemplate: (node: Node, template: string) => Node | null
export let locateHydrationNode: (consumeFragmentStart?: boolean) => void

type Anchor = Node & {
  // Runtime-created or reused preserve anchor that must stay in place during
  // hydration mismatch recovery.
  $vha?: 1

  // cached matching fragment end to avoid repeated traversal on nested
  // comment fragments.
  $fe?: Anchor
}

type CommentAnchor = Comment & Anchor

export const isComment = (node: Node, data: string): node is CommentAnchor =>
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
  node: CommentAnchor,
  open = '[',
  close = ']',
): Node | null {
  // already cached matching end
  if (node.$fe) {
    return node.$fe
  }

  const stack: CommentAnchor[] = [node]
  while ((node = _next(node) as CommentAnchor) && stack.length > 0) {
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

// Find the SSR close marker for the current owner and cache it on the active
// boundary so restore-time cleanup can reuse the same structural limit.
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

  patchCurrentHydrationBoundary({ close })
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

  // Reused hydration anchors are structural boundaries, not replaceable
  // content. Mismatch recovery inserts the new node before the anchor and
  // keeps the anchor in place.
  const shouldPreserveAnchor = isHydrationAnchor(node)
  const container = parentNode(node)!
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
  // only carry over existing children/attrs when the original node is itself
  // an element (the legacy element-vs-element mismatch case).
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
  const end = endAnchor || locateEndAnchor(node as CommentAnchor)
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
  ;(node as Anchor).$vha = 1
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
