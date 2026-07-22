import {
  MismatchTypes,
  isMismatchAllowed,
  isHydrating as isVdomHydrating,
  isHydratingEnabled as isVdomHydratingEnabled,
  logMismatchError,
  warn,
} from '@vue/runtime-dom'
import { type Namespace, Namespaces } from '@vue/shared'
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
  updateLastLocatedLogicalChild,
} from './node'
import { remove } from '../block'

const START_TAG_RE = /^<([^\s/>]+)/

export let isHydratingEnabled = false

export function setIsHydratingEnabled(value: boolean): void {
  isHydratingEnabled = value
}

export let currentHydrationNode: Node | null = null

export let isHydrating = false
function setIsHydrating(value: boolean) {
  if (!isHydratingEnabled && !isVdomHydrating && !isVdomHydratingEnabled) {
    return false
  }
  try {
    return isHydrating
  } finally {
    isHydrating = value
  }
}

let deferredHydrationBoundaryDepth = 0

export function isInDeferredHydrationBoundary(): boolean {
  return deferredHydrationBoundaryDepth > 0
}

export function withDeferredHydrationBoundary<T>(fn: () => T): T {
  deferredHydrationBoundaryDepth++
  try {
    return fn()
  } finally {
    deferredHydrationBoundaryDepth--
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
    ;(Node.prototype as any).$rcn = undefined

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

export let adoptTemplate: (
  node: Node,
  template: string,
  adoptChildren?: boolean,
  ns?: Namespace,
) => Node | null
export let locateHydrationNode: (consumeFragmentStart?: boolean) => void

type Anchor = Node & {
  // Runtime-created or reused hydration anchor that mismatch recovery and
  // boundary cleanup must keep in place.
  $vha?: 1

  // cached matching fragment end to avoid repeated traversal on nested
  // comment fragments.
  $fe?: Anchor
}

type RecreatedNode = Node & {
  // Set on nodes rebuilt by mismatch recovery. The server never rendered
  // these nodes, so hydration-mode prop setters must write to them like a
  // client-side mount instead of adopting them check-only.
  $rcn?: 1
}

type CommentAnchor = Comment & Anchor

export const isComment = (node: Node, data: string): node is CommentAnchor =>
  node.nodeType === 8 && (node as Comment).data === data

export function setCurrentHydrationNode(node: Node | null): void {
  currentHydrationNode = node
}

export function advanceHydrationNode(node: Node): void {
  let next = node.nextSibling
  if (next && currentHydrationNode === next) {
    return
  }
  // if no next sibling, find the next node in the parent chain
  while (!next) {
    const parent = node.parentNode
    if (!parent) break
    node = parent
    next = node.nextSibling
  }
  if (currentHydrationNode !== next) {
    currentHydrationNode = next
  }
}

export type HydrationCursor = {
  start: Node | null
  // `undefined` means this scope follows the cursor advanced by its body.
  // `null` is a real resume point: the outer scope has no next node.
  resume: Node | null | undefined
}

export function enterHydrationCursor(
  consumeFragmentStart = false,
): HydrationCursor {
  const resume = insertionParent ? currentHydrationNode : undefined
  locateHydrationNode(consumeFragmentStart)
  return {
    start: currentHydrationNode,
    resume,
  }
}

/**
 * Capture only the outer resume cursor for dynamic wrappers whose inner owner
 * locates the local start later, after the selected inner path is known.
 * This avoids consuming insertion state too early.
 */
export function captureHydrationCursor(): HydrationCursor {
  return {
    start: null,
    resume: insertionParent ? currentHydrationNode : undefined,
  }
}

export function exitHydrationCursor(cursor: HydrationCursor | null): void {
  if (cursor && cursor.resume !== undefined) {
    setCurrentHydrationNode(cursor.resume)
  }
}

/**
 * Locate the first non-fragment-comment node and locate the next node
 * while handling potential fragments.
 */
function adoptTemplateImpl(
  node: Node,
  template: string,
  adoptChildren = false,
  ns?: Namespace,
): Node | null {
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

  if (!matchesHydrationTarget(node, template)) {
    node = handleMismatch(node, template, adoptChildren, ns)
  }

  advanceHydrationNode(node)
  return node
}

export function nextLogicalSibling(node: Node): Node | null {
  return isComment(node, '[')
    ? locateEndAnchor(node)!.nextSibling
    : isComment(node, 'teleport start')
      ? locateEndAnchor(node, 'teleport start', 'teleport end')!.nextSibling
      : node.nextSibling
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
      let candidate = nextLogicalSibling(node)
      while (candidate && !isComment(candidate, ']')) {
        candidate = nextLogicalSibling(candidate)
      }
      close = candidate
    }
  }

  if (!close) {
    return node
  }

  return close
}

function handleMismatch(
  node: Node,
  template: string,
  adoptChildren: boolean,
  ns?: Namespace,
): Node {
  warnHydrationNodeMismatch(node, template)

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
    const newNode = markRecreatedNode(createTextNode(template))
    container.insertBefore(newNode, next)
    if (!shouldPreserveAnchor) {
      updateLastLocatedLogicalChild(container, node, newNode)
    }
    return newNode
  }

  // element node
  const t = createElement('template') as HTMLTemplateElement
  let newNode: Element
  if (ns) {
    const tag = ns === Namespaces.SVG ? 'svg' : 'math'
    t.innerHTML = `<${tag}>${template}</${tag}>`
    newNode = _child(_child(t.content) as ParentNode).cloneNode(true) as Element
  } else {
    t.innerHTML = template
    newNode = _child(t.content).cloneNode(true) as Element
  }
  markRecreatedNode(newNode)
  if (newNode.nodeType === 1) {
    // Mark template-born descendants before adopting server children below,
    // so adopted server content keeps normal check-only hydration semantics.
    const descendants = newNode.querySelectorAll('*')
    for (let i = 0; i < descendants.length; i++) {
      markRecreatedNode(descendants[i])
    }
  }
  if (adoptChildren && node.nodeType === 1 && !newNode.firstChild) {
    let child = node.firstChild
    while (child) {
      const nextChild = child.nextSibling
      newNode.appendChild(child)
      child = nextChild
    }
  }
  container.insertBefore(newNode, next)
  if (!shouldPreserveAnchor) {
    updateLastLocatedLogicalChild(container, node, newNode)
  }
  return newNode
}

/**
 * Whether a server-rendered node can be adopted for the given client
 * template: the node type must match the template's expected type, and
 * element tags must match exactly — a prefix check is not enough
 * (e.g. a server `<i>` must not be adopted for a client `<ins>`).
 */
function matchesHydrationTarget(node: Node, template: string): boolean {
  let expectedType: number
  if (template[0] !== '<') {
    // text
    expectedType = 3
  } else if (template[1] === '!') {
    // comment
    expectedType = 8
  } else {
    // element
    expectedType = 1
  }

  if (node.nodeType !== expectedType) {
    return false
  }

  if (expectedType !== 1) {
    return true
  }

  const match = START_TAG_RE.exec(template)
  const expectedTag = match && match[1]
  return (
    !expectedTag ||
    (node as Element).tagName.toLowerCase() === expectedTag.toLowerCase()
  )
}

export function validateHydrationTarget(node: Node, template: string): void {
  if (!matchesHydrationTarget(node, template)) {
    warnHydrationNodeMismatch(node, template)
  }
}

export function hydrateTextNode(node: Node, expected: string): boolean {
  if (node.nodeType !== 3) {
    return false
  }
  const text = node as Text
  if (text.data === expected) {
    return true
  }
  const parent = text.parentElement
  if (parent && !isMismatchAllowed(parent, MismatchTypes.TEXT)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      warnHydrationTextMismatch(text, expected)
    logMismatchError()
  }
  text.data = expected
  return true
}

export function warnHydrationTextMismatch(node: Text, expected: string): void {
  warn(
    `Hydration text mismatch in`,
    node.parentNode,
    `\n  - rendered on server: ${JSON.stringify(node.data)}` +
      `\n  - expected on client: ${JSON.stringify(expected)}`,
  )
}

function warnHydrationNodeMismatch(node: Node, expected: unknown): void {
  if (!isMismatchAllowed(node.parentElement!, MismatchTypes.CHILDREN)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      warn(
        `Hydration node mismatch:\n- rendered on server:`,
        node,
        node.nodeType === 3
          ? `(text)`
          : isComment(node, '[')
            ? `(start of fragment)`
            : ``,
        `\n- expected on client:`,
        expected,
      )
    logMismatchError()
  }
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

/**
 * Removes unclaimed server-rendered nodes and reports a children mismatch.
 * Trims `node` alone by default, the rest of `container`'s child list when
 * `container` is given, or the logical siblings up to `close` when leaving a
 * hydration boundary (which also moves the cursor onto `close`). Range cleanup
 * keeps reused hydration anchors in place.
 */
export function cleanupHydrationTail(
  node: Node,
  container?: ParentNode,
  close: Node | null = null,
): void {
  if (close) {
    // A boundary only owns cleanup while the hydration cursor is still inside
    // its SSR range. If nested hydration has already advanced past `close`,
    // stop here so we don't delete sibling or parent-owned SSR nodes by
    // mistake. When the range holds nothing but reused anchors, there is no
    // mismatch to report either - just move the cursor onto `close`.
    let cur: Node | null = node
    let hasRemovableNode = false
    while (cur && cur !== close) {
      if (!isHydrationAnchor(cur)) {
        hasRemovableNode = true
      }
      cur = nextLogicalSibling(cur)
    }
    if (!cur) return
    if (!hasRemovableNode) {
      setCurrentHydrationNode(close)
      return
    }
  }

  const mismatchContainer = container || node.parentElement
  if (mismatchContainer instanceof Element) {
    warnHydrationChildrenMismatch(mismatchContainer)
  }

  if (!container && !close) {
    removeHydrationNode(node)
    return
  }

  let current: Node | null = node
  while (
    current &&
    current !== close &&
    (!container || current.parentNode === container)
  ) {
    const next = nextLogicalSibling(current)
    if (!isHydrationAnchor(current)) {
      removeHydrationNode(current, close)
    }
    current = next
  }

  if (close) {
    setCurrentHydrationNode(close)
  }
}

export function markHydrationAnchor<T extends Node>(node: T): T {
  ;(node as Anchor).$vha = 1
  return node
}

export function isHydrationAnchor(node: Node | null | undefined): boolean {
  return !!node && (node as Anchor).$vha === 1
}

function markRecreatedNode<T extends Node>(node: T): T {
  ;(node as RecreatedNode).$rcn = 1
  return node
}

export function isRecreatedNode(node: Node | null | undefined): boolean {
  return !!node && (node as RecreatedNode).$rcn === 1
}

export function resolveHydrationTarget(node: Node): Node {
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
    // Once the hydration cursor has already reached `close`, this scope has
    // no unclaimed SSR nodes left to trim. Single-root paths commonly end up
    // here, so there is no children-count mismatch to report.
    const node = currentHydrationNode
    if (close && node && node !== close) {
      cleanupHydrationTail(node, undefined, close)
    }
  }
}
