import {
  type ErrorCodes,
  type GenericComponentInstance,
  MismatchTypes,
  callWithErrorHandling,
  isMismatchAllowed,
  isHydrating as isVdomHydrating,
  isHydratingEnabled as isVdomHydratingEnabled,
  logMismatchError,
  warn,
} from '@vue/runtime-dom'
import {
  type Namespace,
  Namespaces,
  isArray,
  isVaporBranchStart,
} from '@vue/shared'
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
  createComment,
  createElement,
  createTextNode,
  locateChildByLogicalIndex,
  parentNode,
  parseTemplate,
  releaseLocatorCache,
  setLastLocatedLogicalChild,
  updateLastLocatedLogicalChild,
} from './node'
import { currentRenderContext } from '../renderContext'
import { setElementScopeIdsDeep } from './scopeIdStamp'
import { type Block, type BlockFn, insert, remove } from '../block'
import type { DynamicFragment } from '../fragment'
import { isHydrating, setHydrating } from './hydrationState'

const START_TAG_RE = /^<([^\s/>]+)/

export let isHydratingEnabled = false

export function setIsHydratingEnabled(value: boolean): void {
  isHydratingEnabled = value
}

export let currentHydrationNode: Node | null = null

export { isHydrating }
function setIsHydrating(value: boolean) {
  if (!isHydratingEnabled && !isVdomHydrating && !isVdomHydratingEnabled) {
    return false
  }
  return setHydrating(value)
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
let afterHydration: (() => void)[] | undefined

/**
 * Runs `cb` once the outermost hydration pass has ended, or now outside one.
 */
export function queueAfterHydration(cb: () => void): void {
  if (hydrationDepth) {
    ;(afterHydration || (afterHydration = [])).push(cb)
  } else {
    cb()
  }
}

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
      currentMismatch = null
      releaseLocatorCache()
      const cbs = afterHydration
      if (cbs) {
        afterHydration = undefined
        for (let i = 0; i < cbs.length; i++) cbs[i]()
      }
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

export function hydrateNode<T>(
  node: Node,
  fn: () => T,
  boundary?: Node | null,
): T {
  const boundaryFlags = boundary ? (boundary as Anchor).$vha : undefined
  const setup = () => {
    // Deferred interop hydration must see its own boundary while recovering.
    if (boundary) claimAnchor(boundary)
    setCurrentHydrationNode(node)
  }
  const cleanup = () => {
    if (boundary) (boundary as Anchor).$vha = boundaryFlags
  }
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
  /** the placeholder of a dynamic text (`' '`, or `''` for text the compiler
   * materializes): the server may have omitted the node */
  blank: boolean
  /** the tag as written of a bare `<tag/>` (createPlainElement,
   * TransitionGroup): on a mismatch it is created directly, not parsed under
   * a namespace wrapper; null otherwise */
  bare: string | null
}

export let adoptTemplate: (
  node: Node,
  template: string,
  ns?: Namespace,
  nested?: boolean,
  target?: AdoptTarget,
) => Node | null
export let locateHydrationNode: (
  claim?: FragmentClaim,
  isBlankText?: boolean,
) => void
export let parseAdoptTarget: (
  template: string,
  isStatic?: boolean,
) => AdoptTarget

const enum AnchorFlags {
  // A node claimed as a fragment's insertion anchor. Mismatch recovery and
  // boundary cleanup must keep it in place instead of trimming it as
  // unclaimed server content. Says nothing about where the node came from:
  // most are adopted from server output, but a few are created by the client
  // to stand in at a position the server left empty (the native-children seed
  // in `component.ts`, teleport target anchors), and those still count as
  // server positions for traversal.
  ANCHOR = 1,
  // The node occupies no SSR logical position, so every traversal primitive
  // steps over it. This — not being client-created — is what lets an anchor be
  // inserted the moment it is resolved instead of after the hydration pass.
  // Alone, it marks client content rendered behind a mismatch-recreated root.
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

export type CommentAnchor = Comment & Anchor

// `<!--(-->`…`<!--)-->` wraps a slot fallback the server rendered, and
// `<!--[1-->`…`<!--]-->` the branch of a v-if chain (isVaporBranchStart): ranges
// like a fragment's for whatever steps over, claims or removes one.
export const isRangeStart = (node: Node): node is CommentAnchor => {
  if (node.nodeType !== 8) return false
  const data = (node as Comment).data
  return data === '[' || data === '(' || isVaporBranchStart(data)
}

export const isRangeEnd = (node: Node): node is CommentAnchor => {
  if (node.nodeType !== 8) return false
  const data = (node as Comment).data
  return data === ']' || data === ')'
}

export const isComment = (node: Node, data: string): node is CommentAnchor =>
  node.nodeType === 8 && (node as Comment).data === data

/** An SSR marker bounding a unit: a fragment, a slot fallback or a teleport. */
export const isBoundaryMarker = (node: Node): boolean =>
  isRangeStart(node) ||
  isRangeEnd(node) ||
  isComment(node, 'teleport start') ||
  isComment(node, 'teleport end')

/** A block's claim on the `<!--[-->` opening its SSR range. */
export interface FragmentClaim {
  start: CommentAnchor | null
}

export function createFragmentClaim(): FragmentClaim {
  return { start: null }
}

/**
 * Consume the fragment start under the cursor for `claim`. A v-if chain claims
 * the range of its branch (`<!--[1-->`) itself: an owner the server gave no
 * range of its own would take the range of the chain it renders.
 */
function claimFragmentStart(claim: FragmentClaim): void {
  const node = currentHydrationNode
  if (node && (isComment(node, '[') || isComment(node, '('))) {
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
 * Adopt the server unit under the cursor for `template`, or recover from the
 * mismatch, and move the cursor past it.
 */
function adoptTemplateImpl(
  node: Node,
  template: string,
  ns?: Namespace,
  // a child of an element this block renders (custom element children,
  // template.ts), as opposed to a root of the block
  nested = false,
  // callers with dynamic template strings (createPlainElement,
  // TransitionGroup) omit this and parse per call
  target: AdoptTarget = parseAdoptTargetImpl(template),
): Node | null {
  if (target.blank) {
    node = resolveBlankTextTarget(node, parentNode(node)!)
  } else {
    if (!matchesAdoptTarget(node, target)) {
      node = handleMismatch(node, template, ns, target, nested)
    } else if (target.type === 3) {
      // a text template is matched by node type; its content is compared and
      // repaired in place, like vdom text hydration
      hydrateTextNode(node as Text, template)
    }
  }

  advanceHydrationNode(node)
  return node
}

export function nextLogicalSibling(node: Node): Node | null {
  if (node.nodeType === 8) {
    const data = (node as Comment).data
    if (data === '[' || data === '(' || isVaporBranchStart(data)) {
      node = locateEndAnchor(node as CommentAnchor, data)!
    } else if (data === 'teleport start') {
      node = locateEndAnchor(node as CommentAnchor, data, 'teleport end')!
    }
  }
  return skipUntrackedAnchors(node.nextSibling)
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
    if (!node) {
      if (isBlankText) {
        // SSR omits an empty text node, so the walk finds nothing at its
        // append position. Seed it there and cache it like a located node.
        node = resolveBlankTextTarget(null, insertionParent)
      } else {
        // The server rendered nothing at this position: the html parser
        // moved the node elsewhere (a `<div>` out of `<svg>`), or the parent
        // was itself recreated by mismatch recovery. Seed an empty comment,
        // which adoptTemplate() replaces like an empty SSR branch.
        node = insertionParent.appendChild(createComment(''))
      }
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
      const data = node.data
      if (
        data === open ||
        // `]` closes a fragment and a v-if branch alike
        (close === ']' && (data === '[' || isVaporBranchStart(data)))
      ) {
        // a nested range walked before is skipped through its cached end
        if (node.$fe) {
          node = node.$fe as CommentAnchor
        } else {
          stack.push(node)
        }
      } else if (data === close) {
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
  // A close located once is never read off the cursor again: by a later call
  // the cursor may rest on an enclosing close of the same kind.
  if (start.$fe) return start.$fe
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

/**
 * Check the branch of a v-if chain the server rendered against the branch
 * `index` the client renders: the `<!--[i-->` under the cursor opens its
 * range, claimed for `claim` when they match. When they differ, the server
 * branch's content goes, the cursor steps past the range and its close is
 * returned, for the client branch to render in front of without hydration.
 * Null when they match, or when the server marked no branch there: a chain
 * whose branches differ by tag.
 */
export function hydrateChainBranch(
  claim: FragmentClaim,
  index: number,
): Node | null {
  const node = currentHydrationNode
  if (
    claim.start ||
    !node ||
    node.nodeType !== 8 ||
    !isVaporBranchStart((node as Comment).data)
  ) {
    return null
  }
  const start = node as CommentAnchor
  if (+start.data.slice(1) === index) {
    claim.start = start
    setCurrentHydrationNode(start.nextSibling)
    return null
  }
  warnHydrationNodeMismatch(start, `branch ${index} of the v-if chain`)
  const close = locateEndAnchor(start)!
  removeFragmentNodes(start, close)
  advanceHydrationNode(close)
  return claimAnchor(close)
}

/**
 * Renders the client's branch of a v-if chain in front of the `close`
 * hydrateChainBranch returned. A function of its own so the effect callbacks
 * hold no closure: one there costs every run a context, hydrating or not.
 */
export function renderChainBranch(
  frag: DynamicFragment,
  close: Node,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
): void {
  frag.anchor = close
  runWithoutHydration(() => frag.update(render, key, noScope))
}

function handleMismatch(
  node: Node,
  template: string,
  ns: Namespace | undefined,
  target: AdoptTarget,
  nested: boolean,
): Node {
  const container = parentNode(node)!
  // everything under a recreated node is missing by construction; the
  // mismatch was reported once for that node
  if (!isRecreatedNode(container)) {
    warnHydrationNodeMismatch(node, template)
  }

  // Reused hydration anchors and the close of the range the block owns are
  // structural boundaries, not replaceable content: the new node goes in
  // front of them and they stay. A range or a teleport under the cursor is
  // one server unit and goes as a whole.
  const shouldPreserveAnchor = isClaimedAnchor(node) || isRangeEnd(node)
  const next = shouldPreserveAnchor ? node : removeHydrationNode(node)

  let newNode: Node
  if (template[0] !== '<') {
    newNode = createTextNode(template)
  } else {
    // A bare element is created directly: parsed under its namespace wrapper,
    // an html element would break out of the foreign content again. A foreign
    // root takes its namespace, as the parser would give it.
    const { bare } = target
    newNode = bare
      ? createElement(
          bare,
          bare === 'svg'
            ? Namespaces.SVG
            : bare === 'math'
              ? Namespaces.MATH_ML
              : ns,
        )
      : parseTemplate(template, ns).cloneNode(true)
    if (newNode.nodeType === 1) {
      // The block hydrates on around a recreated nested child, so writes
      // reaching its template-born descendants must take the client path.
      // Behind a recreated root the block renders on the client anyway.
      if (nested) {
        const descendants = (newNode as Element).querySelectorAll('*')
        for (let i = 0; i < descendants.length; i++) {
          markRecreatedNode(descendants[i])
        }
      }
      // Recreated nodes carry no SSR scope attrs; stamp like a client render.
      const slotScopeIds = currentRenderContext.slotScopeIds
      if (slotScopeIds) {
        setElementScopeIdsDeep(newNode as Element, slotScopeIds)
      }
    }
  }
  markRecreatedNode(newNode)
  container.insertBefore(newNode, next)
  if (!shouldPreserveAnchor) {
    updateLastLocatedLogicalChild(container, node, newNode)
  }
  // A block root turned into client content turns the rest of its block fn
  // into a client render; see hydrateBlock. A nested child is the whole
  // unit: the block hydrates on behind it, into the recreated subtree.
  if (!nested) {
    currentMismatch = newNode
    setIsHydrating(false)
  }
  return newNode
}

function parseAdoptTargetImpl(template: string, isStatic = false): AdoptTarget {
  let type: number
  let tag: string | null = null
  let tagUpper: string | null = null
  let blank = false
  let bare: string | null = null
  if (template[0] !== '<') {
    type = 3 // Text
    // The compiler's two text placeholders. Any other text, whitespace
    // constants included, was rendered by the server; so was a static space
    // (a literal one survives inside <pre>), which only the flag tells apart.
    blank = !isStatic && (template === ' ' || template === '')
  } else if (template[1] === '!') {
    type = 8 // Comment
  } else {
    type = 1 // Element
    const match = START_TAG_RE.exec(template)
    if (match) {
      tag = match[1].toLowerCase()
      tagUpper = match[1].toUpperCase()
      if (template === `<${match[1]}/>`) bare = match[1]
    }
  }
  return { type, tag, tagUpper, blank, bare }
}

/**
 * Whether a server-rendered node can be adopted for the given client
 * template: the node type must match the template's expected type, and
 * element tags must match exactly — a prefix check is not enough
 * (e.g. a server `<i>` must not be adopted for a client `<ins>`).
 * The identity compares handle HTML elements and lowercase foreign elements
 * (svg, path, math) without allocating; the lowercase fallback covers
 * camel-cased foreign elements (linearGradient).
 */
function matchesAdoptTarget(node: Node, target: AdoptTarget): boolean {
  if (node.nodeType !== target.type) {
    return false
  }

  if (target.type !== 1) {
    // a claimed anchor or an SSR marker is a structural boundary, never
    // content; a text node is never a marker
    return (
      !isClaimedAnchor(node) && (target.type === 3 || !isBoundaryMarker(node))
    )
  }

  const tagName = (node as Element).tagName
  return (
    !target.tag ||
    tagName === target.tagUpper ||
    tagName === target.tag ||
    tagName.toLowerCase() === target.tag
  )
}

function hydrateTextNode(text: Text, expected: string): void {
  if (text.data === expected) return
  const parent = text.parentElement
  if (parent && !isMismatchAllowed(parent, MismatchTypes.TEXT)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      warnHydrationTextMismatch(text, expected)
    logMismatchError()
  }
  text.data = expected
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

export function removeFragmentNodes(node: Node, end: Node): void {
  const parent = parentNode(node)
  if (!parent) {
    return
  }
  while (true) {
    const next = _next(node)
    if (next && next !== end) {
      remove(next, parent)
    } else {
      break
    }
  }
}

/**
 * Remove the server unit `node` opens — a range, a teleport or the node by
 * itself — keeping `close` in place, and return the node that followed it.
 */
function removeHydrationNode(
  node: Node,
  close: Node | null = null,
): Node | null {
  const parent = parentNode(node)
  if (!parent) {
    return null
  }
  const end = isRangeStart(node)
    ? locateEndAnchor(node)
    : isComment(node, 'teleport start')
      ? locateEndAnchor(node, 'teleport start', 'teleport end')
      : null
  const next = _next(end || node)
  if (end) {
    removeFragmentNodes(node, end)
    if (end !== close) remove(end, parent)
  }
  remove(node, parent)
  return next
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

/**
 * The root a mismatch of the block being hydrated recreated, if any. Set by
 * `handleMismatch`, which also turns hydration off: the rest of the block fn
 * that adopted the root renders as a client mount. That is vdom's patch(null)
 * for the recreated root, but the roots after it in the block render anew
 * too, where vdom would still hydrate them.
 * The owner of that block fn (`hydrateBlock`) inserts the finished block
 * there and turns hydration back on, so to its own post-processing the block
 * looks like one that hydrated.
 */
let currentMismatch: Node | null = null

/**
 * Runs a block fn as the owner of any mismatch its roots report. Owners trim
 * the server nodes the block no longer adopts when they leave their range.
 * One whose range also holds roots that other owners adopt (an adopted slot
 * fallback) may only trim after a mismatch, which only this helper knows: it
 * passes the range's `close` to have it done here.
 */
export function hydrateBlock<T extends Block>(fn: () => T, close?: Node): T {
  try {
    return finishMismatchRecovery(fn(), close)
  } finally {
    // every owner runs with hydration on; a mismatch inside turned it off
    currentMismatch = null
    setIsHydrating(true)
  }
}

/**
 * `hydrateBlock` without the closure: every component setup and render runs
 * as an owner.
 */
export function hydrateBlockWithErrorHandling(
  fn: Function,
  instance: GenericComponentInstance,
  type: ErrorCodes,
  args?: unknown[],
): any {
  try {
    return finishMismatchRecovery(
      callWithErrorHandling(fn, instance, type, args),
    )
  } finally {
    currentMismatch = null
    setIsHydrating(true)
  }
}

function finishMismatchRecovery<T extends Block>(block: T, close?: Node): T {
  const root = currentMismatch
  if (root && block) {
    // The recreated root took over the server unit's position, and any
    // root before it hydrated in place; the roots behind it are the
    // detached ones. They hold no server position, so logical-index
    // locates step over them, but they are content, not anchors
    // (isValidBlock).
    const parent = root.parentNode!
    const next = root.nextSibling
    const roots: Block[] = isArray(block) ? block : [block]
    let i = roots.indexOf(root) + 1
    if (__DEV__ && i === 0) {
      warn(
        `Hydration mismatch recovery: the recreated root is not a root of ` +
          `the block that reported it. This is likely a Vue internal bug.`,
      )
    }
    for (; i < roots.length; i++) insert(roots[i], parent, next)
    for (let n = root.nextSibling; n && n !== next; n = n.nextSibling) {
      // a runtime anchor among them keeps its ANCHOR bit
      ;(n as Anchor).$vha! |= AnchorFlags.UNTRACKED
    }
    if (close) trimHydrationBoundary(close)
  }
  return block
}

function markRecreatedNode(node: Node): void {
  ;(node as RecreatedNode).$rcn = 1
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

  if (node && node.nodeType === 3 /* Text */ && !isClaimedAnchor(node)) {
    return node
  }

  const text = createTextNode()
  parent.insertBefore(text, node)
  // the seeded text takes over the logical position `node` was cached at
  if (node) updateLastLocatedLogicalChild(parent, node, text)
  return text
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
