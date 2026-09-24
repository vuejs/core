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
  insertionAnchor,
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
  releaseLocatorCache,
  setLastLocatedLogicalChild,
  updateLastLocatedLogicalChild,
} from './node'
import { currentRenderContext } from '../renderContext'
import { setElementScopeIdsDeep } from './scopeIdStamp'
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

// The server rendered a slot's fallback (`<!--(-->`): the nodes under the
// cursor are the fallback's, so the slot content runs without hydration and
// the fallback is adopted from within it. Set for that window: the slot that
// shows the fallback finds it in the DOM already and leaves it in place.
export let isHydratingSlotFallback = false

export function withHydratingSlotFallback(fn: () => void): void {
  const prev = isHydratingSlotFallback
  isHydratingSlotFallback = true
  try {
    runWithoutHydration(fn)
  } finally {
    isHydratingSlotFallback = prev
  }
}

let isOptimized = false

let hydrationDepth = 0
// dev-only: cursors handed out but not yet handed back, checked when the
// outermost hydration pass finishes. A leaked cursor means some enclosing
// scope never had its resume point restored, which shows up far away as a
// drifted cursor.
let liveCursors = 0

function performHydration<T>(
  fn: () => T,
  setup: () => void,
  cleanup: () => void,
): T {
  if (!isOptimized) {
    adoptTemplate = adoptTemplateImpl
    locateHydrationNode = locateHydrationNodeImpl
    parseAdoptTarget = parseAdoptTargetImpl
    // optimize anchor cache lookup
    ;(Comment.prototype as any).$fe = undefined
    ;(Node.prototype as any).$llc = undefined
    ;(Node.prototype as any).$lli = undefined
    ;(Node.prototype as any).$vha = 0
    ;(Node.prototype as any).$rcn = undefined

    isOptimized = true
  }
  const prev = setIsHydrating(true)
  const prevHydrationNode = currentHydrationNode
  currentHydrationNode = null
  hydrationDepth++
  try {
    setup()
    return fn()
  } finally {
    cleanup()
    currentHydrationNode = prevHydrationNode
    setIsHydrating(prev)
    // `isHydrating` is no pass boundary: nested passes and
    // `runWithoutHydration` flip it mid-walk. Only the outermost exit ends
    // the walk the locator cache belongs to.
    if (--hydrationDepth === 0) {
      releaseLocatorCache()
      if (__DEV__) {
        if (liveCursors > 0) {
          warn(
            `${liveCursors} hydration cursor(s) were never exited. The ` +
              `enclosing scope's resume point is lost, so the cursor will ` +
              `drift. This is likely a Vue internal bug.`,
          )
        }
        liveCursors = 0
      }
    }
  }
}

export function withHydration(container: ParentNode, fn: () => void): void {
  const setup = () => setInsertionState(container)
  const cleanup = () => resetInsertionState()
  return performHydration(fn, setup, cleanup)
}

export function hydrateNode<T>(node: Node, fn: () => T): T {
  const setup = () => setCurrentHydrationNode(node)
  const cleanup = () => {}
  return performHydration(fn, setup, cleanup)
}

/**
 * Per-template parse of what a template string expects to adopt, so hot
 * per-instance adoption compares integers and identities instead of
 * re-scanning the string. `template()` computes this once per template
 * factory and passes it back in on every adoption.
 */
export interface AdoptTarget {
  /** expected nodeType: 1 element, 3 text, 8 comment */
  type: number
  /** lowercase tag name for elements, null when not applicable */
  tag: string | null
  /** uppercase tag name — matches `tagName` for HTML elements directly */
  tagUpper: string | null
  /** whitespace-only text template (empty slot text handling) */
  blank: boolean
}

export let adoptTemplate: (
  node: Node,
  template: string,
  adoptChildren?: boolean,
  ns?: Namespace,
  target?: AdoptTarget,
) => Node | null
export let locateHydrationNode: (
  claim?: FragmentClaim,
  isBlankText?: boolean,
) => void
export let parseAdoptTarget: (template: string) => AdoptTarget

const enum AnchorFlags {
  // A node claimed as a fragment's insertion anchor. Mismatch recovery and
  // boundary cleanup must keep it in place instead of trimming it as
  // unclaimed server content. Says nothing about where the node came from:
  // most are adopted from server output, but a few are created by the client
  // to stand in at a position the server left empty (the native-children seed
  // in `component.ts`, teleport target anchors), and those still count as
  // server positions for traversal.
  ANCHOR = 1,
  // The anchor occupies no SSR logical position, so every traversal primitive
  // steps over it. This — not being client-created — is what lets an anchor be
  // inserted the moment it is resolved instead of after the hydration pass.
  UNTRACKED = 2,
}

type Anchor = Node & {
  $vha?: number

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

// `<!--(-->`…`<!--)-->` wraps a slot fallback the server rendered: a range like
// a fragment's for whatever steps over, claims or removes one.
export const isRangeStart = (node: Node): node is CommentAnchor =>
  node.nodeType === 8 &&
  ((node as Comment).data === '[' || (node as Comment).data === '(')

export const isRangeEnd = (node: Node): node is CommentAnchor =>
  node.nodeType === 8 &&
  ((node as Comment).data === ']' || (node as Comment).data === ')')

export const isComment = (node: Node, data: string): node is CommentAnchor =>
  node.nodeType === 8 && (node as Comment).data === data

/** A block's claim on the `<!--[-->` opening its SSR range. */
export interface FragmentClaim {
  start: CommentAnchor | null
}

export function createFragmentClaim(): FragmentClaim {
  return { start: null }
}

/** Consume the fragment start under the cursor for `claim`. */
function claimFragmentStart(claim: FragmentClaim): void {
  const node = currentHydrationNode
  if (node && isRangeStart(node)) {
    claim.start = node
    setCurrentHydrationNode(node.nextSibling)
  }
}

export function setCurrentHydrationNode(node: Node | null): void {
  currentHydrationNode = skipUntrackedAnchors(node)
}

export function advanceHydrationNode(node: Node): void {
  let next = skipUntrackedAnchors(node.nextSibling)
  if (next && currentHydrationNode === next) {
    return
  }
  // if no next sibling, find the next node in the parent chain
  while (!next) {
    const parent = node.parentNode
    if (!parent) break
    node = parent
    next = skipUntrackedAnchors(node.nextSibling)
  }
  if (currentHydrationNode !== next) {
    currentHydrationNode = next
  }
}

/**
 * ## Cursor protocol
 *
 * Hydration walks the server DOM once through a single module-level cursor
 * (`currentHydrationNode`). Every block-creating API borrows it and must hand
 * it back, which is what these three helpers express:
 *
 * - `enterHydrationCursor(claim)` — locate this block's own start node *and*
 *   remember where the enclosing scope should resume. Pass a `FragmentClaim`
 *   when the block's server output is wrapped in `<!--[-->…<!--]-->` and the
 *   body should start after the opening marker (multi-root branches, `v-for`
 *   lists); the claim records whether the block owns the marker.
 * - `captureHydrationCursor()` — remember the resume point *without* locating
 *   a start node, for wrappers whose inner owner locates its own start later
 *   (dynamic components, keyed fragments, slot outlets). Locating early would
 *   consume the insertion state before the inner path is known.
 * - `exitHydrationCursor(cursor)` — restore the enclosing scope's resume
 *   point. Every cursor from either constructor must reach this exactly once;
 *   `finishBlockCreation` in `fragment.ts` is the shared tail for the
 *   block-creating APIs.
 *
 * `resume` distinguishes two states that look alike and are not:
 * `undefined` means "this scope had no insertion parent, so let whatever the
 * body advanced to stand", while `null` is a real resume point meaning "the
 * enclosing scope has no next node". Collapsing them strands the cursor.
 */
export type HydrationCursor = {
  start: Node | null
  resume: Node | null | undefined
  /** dev-only: set once handed back, so a second exit can be caught */
  exited?: boolean
}

export function enterHydrationCursor(
  claim?: FragmentClaim,
  isBlankText?: boolean,
): HydrationCursor {
  const cursor = captureHydrationCursor()
  locateHydrationNode(claim, isBlankText)
  cursor.start = currentHydrationNode
  return cursor
}

/**
 * Capture the outer resume cursor without locating a start node, for dynamic
 * wrappers whose inner owner locates the local start later, after the selected
 * inner path is known. This avoids consuming insertion state too early.
 */
export function captureHydrationCursor(): HydrationCursor {
  if (__DEV__) liveCursors++
  const cursor: HydrationCursor = {
    start: null,
    resume: insertionParent ? currentHydrationNode : undefined,
  }
  return cursor
}

export function exitHydrationCursor(cursor: HydrationCursor | null): void {
  if (!cursor) return
  if (__DEV__) {
    if (cursor.exited) {
      // Restoring twice rewinds the cursor over nodes a sibling has already
      // claimed. Only a Vue-internal bug gets here, and the warning turns it
      // into a test failure, so guarding dev alone is enough — prod carries
      // neither the flag nor the branch.
      warn(
        `Hydration cursor was exited twice. This is likely a Vue internal bug.`,
      )
      return
    }
    // count each cursor once, or a double exit would mask a leak
    cursor.exited = true
    liveCursors--
  }
  if (cursor.resume !== undefined) {
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
  // callers with dynamic template strings (createPlainElement,
  // TransitionGroup) omit this and parse per call
  target: AdoptTarget = parseAdoptTargetImpl(template),
): Node | null {
  if (target.type !== 8 /* Comment */) {
    node = target.blank
      ? resolveBlankTextTarget(node, parentNode(node)!)
      : resolveHydrationTarget(node)
  }

  if (!matchesAdoptTarget(node, target)) {
    node = handleMismatch(node, template, adoptChildren, ns)
  }

  advanceHydrationNode(node)
  return node
}

export function nextLogicalSibling(node: Node): Node | null {
  return skipUntrackedAnchors(
    isRangeStart(node)
      ? locateEndAnchor(node)!.nextSibling
      : isComment(node, 'teleport start')
        ? locateEndAnchor(node, 'teleport start', 'teleport end')!.nextSibling
        : node.nextSibling,
  )
}

/** Advance past anchors that occupy no SSR logical position. */
export function skipUntrackedAnchors(node: Node | null): Node | null {
  while (node !== null && (node as Anchor).$vha! & AnchorFlags.UNTRACKED) {
    node = node.nextSibling
  }
  return node
}

function locateHydrationNodeImpl(claim?: FragmentClaim, isBlankText?: boolean) {
  let node: Node | null

  if (insertionAnchor) {
    // anchored insert: the located placeholder unit is the hydration target
    node = insertionAnchor
  } else if (insertionParent) {
    // append: skip the preceding logical units (0 when absent — sole-child
    // appends and withHydration entry). Locating through the logical walk
    // also stamps $llc/$lli so mismatch recovery keeps the cache coherent.
    node = locateChildByLogicalIndex(insertionParent, insertionIndex || 0)
    if (!node && isBlankText) {
      // SSR omits an empty text node, so the walk finds nothing at its
      // append position. Seed it there and cache it like a located node.
      node = resolveBlankTextTarget(null, insertionParent)
      setLastLocatedLogicalChild(insertionParent, node, insertionIndex || 0)
    }
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
  setCurrentHydrationNode(node)
  if (claim) claimFragmentStart(claim)
}

/**
 * The end anchor of the SSR fragment starting at `node`, or null when `node`
 * is not a fragment start.
 */
export function locateFragmentEnd(node: Node | null): Node | null {
  return node && isRangeStart(node) ? locateEndAnchor(node) : null
}

export function locateEndAnchor(
  node: CommentAnchor,
  // the pair of the range `node` opens
  open: string = node.data,
  close: string = open === '(' ? ')' : ']',
): Node | null {
  // already cached matching end
  if (node.$fe) {
    return node.$fe
  }

  const stack: CommentAnchor[] = [node]
  while ((node = _next(node) as CommentAnchor) && stack.length > 0) {
    if (node.nodeType === 8) {
      if (node.data === open) {
        // a nested range walked before is skipped through its cached end
        if (node.$fe) {
          node = node.$fe as CommentAnchor
        } else {
          stack.push(node)
        }
      } else if (node.data === close) {
        const matchingOpen = stack.pop()!
        matchingOpen.$fe = node
        if (stack.length === 0) return node
      }
    }
  }

  return null
}

/**
 * The close marker of a claimed range once its content hydrated. The cursor
 * normally rests on it, so only a mismatch pays for the walk from `start`.
 */
export function locateClaimedEnd(start: CommentAnchor): Node | null {
  const node = currentHydrationNode
  if (
    node &&
    isComment(node, start.data === '(' ? ')' : ']') &&
    !isClaimedAnchor(node)
  ) {
    return (start.$fe = node)
  }
  return locateEndAnchor(start)
}

function handleMismatch(
  node: Node,
  template: string,
  adoptChildren: boolean,
  ns?: Namespace,
): Node {
  warnHydrationNodeMismatch(node, template)

  // fragment
  if (isRangeStart(node)) {
    removeFragmentNodes(node)
  }

  // Reused hydration anchors are structural boundaries, not replaceable
  // content. Mismatch recovery inserts the new node before the anchor and
  // keeps the anchor in place.
  const shouldPreserveAnchor = isClaimedAnchor(node)
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
    // Recreated nodes carry no SSR scope attrs; run the same creation-time
    // stamping a client render would, before server children are adopted in.
    const slotScopeIds = currentRenderContext.slotScopeIds
    if (slotScopeIds) setElementScopeIdsDeep(newNode as Element, slotScopeIds)
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

function parseAdoptTargetImpl(template: string): AdoptTarget {
  let type: number
  let tag: string | null = null
  let tagUpper: string | null = null
  let blank = false
  if (template[0] !== '<') {
    type = 3 // Text
    blank = template.trim() === ''
  } else if (template[1] === '!') {
    type = 8 // Comment
  } else {
    type = 1 // Element
    const match = START_TAG_RE.exec(template)
    if (match) {
      tag = match[1].toLowerCase()
      tagUpper = match[1].toUpperCase()
    }
  }
  return { type, tag, tagUpper, blank }
}

/**
 * Whether a server-rendered node can be adopted for the given client
 * template: the node type must match the template's expected type, and
 * element tags must match exactly — a prefix check is not enough
 * (e.g. a server `<i>` must not be adopted for a client `<ins>`).
 * The uppercase identity compare handles HTML elements without allocating;
 * the lowercase fallback covers case-preserving foreign elements (SVG/MathML).
 */
function matchesAdoptTarget(node: Node, target: AdoptTarget): boolean {
  if (node.nodeType !== target.type) {
    return false
  }

  if (target.type !== 1) {
    return true
  }

  return (
    !target.tag ||
    (node as Element).tagName === target.tagUpper ||
    (node as Element).tagName.toLowerCase() === target.tag
  )
}

export function validateHydrationTarget(node: Node, template: string): void {
  if (!matchesAdoptTarget(node, parseAdoptTargetImpl(template))) {
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

export function warnHydrationNodeMismatch(node: Node, expected: unknown): void {
  if (!isMismatchAllowed(node.parentElement!, MismatchTypes.CHILDREN)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      warn(
        `Hydration node mismatch:\n- rendered on server:`,
        node,
        node.nodeType === 3
          ? `(text)`
          : isRangeStart(node)
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

  if (isRangeStart(node)) {
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
      if (!isClaimedAnchor(cur)) {
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
    if (!isClaimedAnchor(current)) {
      removeHydrationNode(current, close)
    }
    current = next
  }

  if (close) {
    setCurrentHydrationNode(close)
  }
}

/**
 * Claim a node as some fragment's insertion anchor standing AT an SSR
 * logical position. Claiming a previously untracked anchor promotes it into
 * the position stream — a revived deferred branch does this when its runtime
 * anchor takes over the logical unit the branch occupies. Use
 * `claimUntrackedAnchor` for an anchor that must stay invisible to traversal.
 */
export function claimAnchor<T extends Node>(node: T): T {
  ;(node as Anchor).$vha = AnchorFlags.ANCHOR
  return node
}

/**
 * Claim a node as an anchor that holds no SSR logical position, so hydration
 * traversal steps over it and inserting one mid-pass cannot shift the
 * positions the server output defines. See `AnchorFlags.UNTRACKED`.
 */
export function claimUntrackedAnchor<T extends Node>(node: T): T {
  ;(node as Anchor).$vha = AnchorFlags.ANCHOR | AnchorFlags.UNTRACKED
  return node
}

/**
 * Whether some fragment owns this node as its insertion anchor, whatever its
 * origin. Cleanup and mismatch recovery must leave it in place.
 */
export function isClaimedAnchor(node: Node | null | undefined): boolean {
  return !!node && !!((node as Anchor).$vha! & AnchorFlags.ANCHOR)
}

function markRecreatedNode<T extends Node>(node: T): T {
  ;(node as RecreatedNode).$rcn = 1
  return node
}

export function isRecreatedNode(node: Node | null | undefined): boolean {
  return !!node && (node as RecreatedNode).$rcn === 1
}

/**
 * SSR omits empty text nodes. Block owners consume their opening markers
 * before template adoption. Preserve any remaining boundary or sibling while
 * seeding the missing text at its logical position.
 */
export function resolveBlankTextTarget(
  node: Node | null,
  parent: ParentNode,
): Node {
  node = skipUntrackedAnchors(node)

  if (node && node.nodeType === 3 /* Text */) {
    return node
  }

  const text = createTextNode()
  parent.insertBefore(text, node)
  // the seeded text takes over the logical position `node` was cached at
  if (node) updateLastLocatedLogicalChild(parent, node, text)
  return text
}

export function resolveHydrationTarget(node: Node): Node {
  while (true) {
    // One read covers both anchor questions: an untracked anchor holds no
    // server position and is stepped over rather than offered up for adoption
    // (which would report a spurious mismatch); any other claimed anchor is
    // the target itself. Unlike `skipUntrackedAnchors`, a trailing run of
    // anchors resolves to the last one — the caller needs a node, not null.
    const flags = (node as Anchor).$vha!
    if (flags) {
      if (!(flags & AnchorFlags.UNTRACKED)) return node
    } else if (
      !(
        isRangeStart(node) ||
        isRangeEnd(node) ||
        isComment(node, 'teleport start') ||
        isComment(node, 'teleport end')
      )
    ) {
      return node
    }

    const next = node.nextSibling
    if (!next) return node
    node = next
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
  return () => trimHydrationBoundary(close)
}

/** Trim the unclaimed SSR nodes left between the cursor and `close`. */
export function trimHydrationBoundary(close: Node | null): void {
  // Once the hydration cursor has already reached `close`, this scope has
  // no unclaimed SSR nodes left to trim. Single-root paths commonly end up
  // here, so there is no children-count mismatch to report.
  const node = currentHydrationNode
  if (
    close &&
    node &&
    node !== close &&
    // The cursor can also have advanced *past* `close`: a fragment that
    // claims the close marker as its own anchor moves beyond it, and
    // `advanceHydrationNode` climbs to the parent's next sibling at the end
    // of a child list. `cleanupHydrationTail` detects that and bails, but
    // only after walking forward for a node that is already behind us —
    // once per boundary, which is quadratic over a list of them. Ask the
    // DOM instead.
    !(close.compareDocumentPosition(node) & 4 /* DOCUMENT_POSITION_FOLLOWING */)
  ) {
    cleanupHydrationTail(node, undefined, close)
  }
}
