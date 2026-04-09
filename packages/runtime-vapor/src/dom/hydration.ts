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

    node = resolveHydrationTarget(node, template)
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

export function markHydrationAnchor<T extends Node>(node: T): T {
  ;(node as any).$vha = 1
  return node
}

export function isHydrationAnchor(node: Node | null | undefined): boolean {
  return !!node && (node as Anchor).$vha === 1
}

function resolveHydrationTarget(node: Node, template: string): Node {
  while (true) {
    if (isHydrationAnchor(node)) {
      const next = node.nextSibling
      if (next && canUseAsHydrationTarget(next, template)) {
        node = next
        continue
      }
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

function canUseAsHydrationTarget(node: Node, template: string): boolean {
  if (template[0] !== '<') {
    return node.nodeType === 3
  }

  if (template.startsWith('<!')) {
    return node.nodeType === 8
  }

  return (
    node.nodeType === 1 &&
    template.startsWith(`<${(node as Element).tagName.toLowerCase()}`)
  )
}
