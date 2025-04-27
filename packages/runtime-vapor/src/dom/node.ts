import { isComment, isEmptyText, locateEndAnchor } from './hydration'
import {
  DYNAMIC_END_ANCHOR_LABEL,
  DYNAMIC_START_ANCHOR_LABEL,
  isDynamicAnchor,
  isVaporFragmentEndAnchor,
} from '@vue/shared'

/*! #__NO_SIDE_EFFECTS__ */
export function createTextNode(value = ''): Text {
  return document.createTextNode(value)
}

/*! #__NO_SIDE_EFFECTS__ */
export function createComment(data: string): Comment {
  return document.createComment(data)
}

/*! #__NO_SIDE_EFFECTS__ */
export function querySelector(selectors: string): Element | null {
  return document.querySelector(selectors)
}

/*! #__NO_SIDE_EFFECTS__ */
export function _child(node: ParentNode): Node {
  return node.firstChild!
}

/*! #__NO_SIDE_EFFECTS__ */
export function __child(node: ParentNode): Node {
  /**
   * During hydration, the first child of a node not be the expected
   * if the first child is slot
   *
   * for template code: `div><slot />{{ data }}</div>`
   * - slot: 'slot',
   * - data: 'hi',
   *
   * client side:
   * const n2 = _template("<div> </div>")()
   * const n1 = _child(n2) -> the text node
   * _setInsertionState(n2, 0) -> slot fragment
   *
   * during hydration:
   * const n2 = _template("<div><!--[-->slot<!--]--><!--slot-->Hi</div>")()
   * const n1 = _child(n2) -> should be `Hi` instead of the slot fragment
   * _setInsertionState(n2, 0) -> slot fragment
   */
  let n = node.firstChild!

  if (isComment(n, '[')) {
    n = locateEndAnchor(n)!.nextSibling!
  }

  while (n && isVaporFragmentEndAnchor(n)) {
    n = n.nextSibling!
  }
  return n
}

/*! #__NO_SIDE_EFFECTS__ */
export function _nthChild(node: Node, i: number): Node {
  return node.childNodes[i]
}

/*! #__NO_SIDE_EFFECTS__ */
export function __nthChild(node: Node, i: number): Node {
  let n = node.firstChild!
  for (let start = 0; start < i; start++) {
    n = next(n) as ChildNode
  }
  return n
}

/*! #__NO_SIDE_EFFECTS__ */
function _next(node: Node): Node {
  return node.nextSibling!
}

/*! #__NO_SIDE_EFFECTS__ */
export function __next(node: Node): Node {
  node = handleWrappedNode(node)

  let n = node.nextSibling!
  while (n && isNonHydrationNode(n)) {
    n = n.nextSibling!
  }
  return n
}

type ChildFn = (node: ParentNode) => Node
type NextFn = (node: Node) => Node
type NthChildFn = (node: Node, i: number) => Node

interface DelegatedChildFunction extends ChildFn {
  impl: ChildFn
}
interface DelegatedNextFunction extends NextFn {
  impl: NextFn
}
interface DelegatedNthChildFunction extends NthChildFn {
  impl: NthChildFn
}

/*! #__NO_SIDE_EFFECTS__ */
export const child: DelegatedChildFunction = node => {
  return child.impl(node)
}
child.impl = _child

/*! #__NO_SIDE_EFFECTS__ */
export const next: DelegatedNextFunction = node => {
  return next.impl(node)
}
next.impl = _next

/*! #__NO_SIDE_EFFECTS__ */
export const nthChild: DelegatedNthChildFunction = (node, i) => {
  return nthChild.impl(node, i)
}
nthChild.impl = _nthChild

// During hydration, there might be differences between the server-rendered (SSR)
// HTML and the client-side template.
// For example, a dynamic node `<!>` in the template might be rendered as a
// `Fragment` (`<!--[-->...<!--]-->`) in the SSR output.
// The content of the `Fragment` affects the lookup results of the `next` and
// `nthChild` functions.
// To ensure the hydration process correctly finds nodes, we need to treat the
// `Fragment` as a single node.
// Therefore, during hydration, we need to temporarily switch the implementations
// of `next` and `nthChild`. After hydration is complete, their implementations
// are restored to the original versions.
export function enableHydrationNodeLookup(): void {
  child.impl = __child
  next.impl = __next
  nthChild.impl = __nthChild
}

export function disableHydrationNodeLookup(): void {
  child.impl = _child
  next.impl = _next
  nthChild.impl = _nthChild
}

function isNonHydrationNode(node: Node) {
  return (
    // empty text nodes, no need to hydrate
    isEmptyText(node) ||
    // dynamic node anchors (<!--[[-->, <!--]]-->)
    isDynamicAnchor(node) ||
    // fragment end anchor (`<!--]-->`)
    isComment(node, ']') ||
    // vapor fragment end anchors
    isVaporFragmentEndAnchor(node)
  )
}

export function findVaporFragmentAnchor(
  node: Node,
  anchorLabel: string,
): Comment | null {
  let n = node.nextSibling
  while (n) {
    if (isComment(n, anchorLabel)) return n
    n = n.nextSibling
  }

  return null
}

function handleWrappedNode(node: Node): Node {
  // process dynamic node (<!--[[-->...<!--]]-->) as a single one
  if (isComment(node, DYNAMIC_START_ANCHOR_LABEL)) {
    return locateEndAnchor(
      node,
      DYNAMIC_START_ANCHOR_LABEL,
      DYNAMIC_END_ANCHOR_LABEL,
    )!
  }

  // process fragment (<!--[-->...<!--]-->) as a single one
  else if (isComment(node, '[')) {
    return locateEndAnchor(node)!
  }

  return node
}
