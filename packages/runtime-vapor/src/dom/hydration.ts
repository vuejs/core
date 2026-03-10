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
  disableHydrationNodeLookup,
  enableHydrationNodeLookup,
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

    isOptimized = true
  }
  enableHydrationNodeLookup()
  const prev = setIsHydrating(true)
  const prevHydrationNode = currentHydrationNode
  const prevHydrationBoundary = currentHydrationBoundary
  const prevHydrationEntry = currentHydrationEntry
  currentHydrationNode = null
  currentHydrationBoundary = null
  currentHydrationEntry = null
  try {
    setup()
    return fn()
  } finally {
    cleanup()
    currentHydrationNode = prevHydrationNode
    currentHydrationBoundary = prevHydrationBoundary
    currentHydrationEntry = prevHydrationEntry
    setIsHydrating(prev)
    if (!isHydrating) disableHydrationNodeLookup()
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

/* @__NO_SIDE_EFFECTS__ */
function locateNextSiblingOfParent(n: Node): Node | null {
  if (!n.parentNode) return null
  return n.parentNode.nextSibling || locateNextSiblingOfParent(n.parentNode)
}

export function advanceHydrationNode(node: Node): void {
  // if no next sibling, find the next node in the parent chain
  const ret = node.nextSibling || locateNextSiblingOfParent(node)
  if (ret) setCurrentHydrationNode(ret)
}

/**
 * Locate the first non-fragment-comment node and locate the next node
 * while handling potential fragments.
 */
function adoptTemplateImpl(node: Node, template: string): Node | null {
  prepareHydrationChildEntry()

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

  if (insertionIndex !== undefined) {
    // use logicalIndex to locate the node
    node = locateChildByLogicalIndex(insertionParent!, insertionIndex)
  } else if (insertionParent) {
    // no logicalIndex: withHydration entry initialization
    node = insertionParent.firstChild
  } else {
    node = currentHydrationNode
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

interface HydrationEntry {
  parent: HydrationEntry | null
  node: Node | null
}

export interface HydrationBoundary {
  parent: HydrationBoundary | null
  mode: 'known-single' | 'known-fragment' | 'deferred'
  state: 'pending' | 'resolved-single' | 'resolved-fragment'
  entry: Node | null
  start: Anchor | null
  end: Anchor | null
}

let currentHydrationBoundary: HydrationBoundary | null = null
let currentHydrationEntry: HydrationEntry | null = null

function pushHydrationEntry(node: Node | null): void {
  currentHydrationEntry = {
    parent: currentHydrationEntry,
    node,
  }
}

function popHydrationEntry(): void {
  currentHydrationEntry = currentHydrationEntry && currentHydrationEntry.parent
}

export function withHydrationEntry<T>(node: Node | null, fn: () => T): T {
  pushHydrationEntry(node)
  try {
    return fn()
  } finally {
    popHydrationEntry()
  }
}

export function getCurrentHydrationEntry(): Node | null {
  return (
    (currentHydrationBoundary && currentHydrationBoundary.entry) ??
    (currentHydrationEntry && currentHydrationEntry.node) ??
    null
  )
}

function pushHydrationBoundary(
  mode: HydrationBoundary['mode'],
  entry: Node | null,
): HydrationBoundary {
  const boundary: HydrationBoundary = {
    parent: currentHydrationBoundary,
    mode,
    state: 'pending',
    entry,
    start: null,
    end: null,
  }
  return (currentHydrationBoundary = boundary)
}

function popHydrationBoundary(boundary: HydrationBoundary): void {
  if (currentHydrationBoundary === boundary) {
    currentHydrationBoundary = boundary.parent
  }
}

export function withHydrationBoundary<T>(
  mode: HydrationBoundary['mode'],
  entry: Node | null,
  fn: (boundary: HydrationBoundary) => T,
): T {
  const boundary = pushHydrationBoundary(mode, entry)
  try {
    return fn(boundary)
  } finally {
    popHydrationBoundary(boundary)
  }
}

export function resolveHydrationBoundaryEnd(
  boundary: HydrationBoundary | null,
): Anchor | null {
  if (!boundary || boundary.state !== 'resolved-fragment' || !boundary.start) {
    return null
  }

  return (boundary.end ||= locateEndAnchor(boundary.start) as Anchor | null)
}

export function resolveEmptyHydrationBoundary(
  boundary: HydrationBoundary | null,
): HydrationBoundary | null {
  if (!boundary || boundary.state !== 'pending') {
    return boundary
  }

  const start = resolvePendingHydrationBoundaryStart(boundary)
  if (start) {
    resolveHydrationBoundaryAsFragment(boundary, start)
  }
  return boundary
}

function resolvePendingHydrationBoundary(
  boundary: HydrationBoundary,
  isFragment: boolean,
): void {
  const start = resolvePendingHydrationBoundaryStart(boundary)
  if (!start) return

  if (
    boundary.mode === 'known-fragment' ||
    !isFragment ||
    isComment(start.nextSibling!, '[')
  ) {
    resolveHydrationBoundaryAsFragment(boundary, start)
    return
  }

  boundary.state = 'resolved-single'
}

function resolvePendingHydrationBoundaryStart(
  boundary: HydrationBoundary,
): Anchor | null {
  if (boundary.mode === 'known-single') {
    boundary.state = 'resolved-single'
    return null
  }

  const node = currentHydrationNode
  if (!(node && isComment(node, '['))) {
    boundary.state = 'resolved-single'
    return null
  }

  if (node.previousSibling && node !== boundary.entry) {
    boundary.state = 'resolved-single'
    return null
  }

  return node
}

function resolveHydrationBoundaryAsFragment(
  boundary: HydrationBoundary,
  start: Anchor,
): void {
  boundary.start = start
  boundary.state = 'resolved-fragment'
  currentHydrationNode = start.nextSibling
}

export function prepareHydrationChildEntry(isFragment = false): void {
  if (!currentHydrationBoundary) return
  const pending: HydrationBoundary[] = []
  for (
    let boundary: HydrationBoundary | null = currentHydrationBoundary;
    boundary;
    boundary = boundary.parent
  ) {
    if (boundary.state === 'pending') {
      pending.push(boundary)
    }
  }

  for (let i = pending.length - 1; i >= 0; i--) {
    resolvePendingHydrationBoundary(pending[i], isFragment)
  }
}
