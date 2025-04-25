import { isDynamicAnchor } from '@vue/runtime-dom'
import {
  isComment,
  isEmptyText,
  locateEndAnchor,
  locateStartAnchor,
} from './hydration'

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
export function child(node: ParentNode): Node {
  return node.firstChild!
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

type NextFn = (node: Node) => Node
type NthChildFn = (node: Node, i: number) => Node

interface DelegatedNextFunction extends NextFn {
  impl: NextFn
}
interface DelegatedNthChildFunction extends NthChildFn {
  impl: NthChildFn
}

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
  next.impl = __next
  nthChild.impl = __nthChild
}

export function disableHydrationNodeLookup(): void {
  next.impl = _next
  nthChild.impl = _nthChild
}

/*! #__NO_SIDE_EFFECTS__ */
export function prev(node: Node): Node | null {
  // process dynamic node (<!--[[-->...<!--]]-->) as a single one
  if (isComment(node, ']]')) {
    node = locateStartAnchor(node, '[[', ']]')!
  }

  // process fragment node (<!--[-->...<!--]-->) as a single one
  else if (isComment(node, ']')) {
    node = locateStartAnchor(node)!
  }

  let n = node.previousSibling
  while (n && isNonHydrationNode(n)) {
    n = n.previousSibling
  }
  return n
}

function isNonHydrationNode(node: Node) {
  return (
    // empty text nodes, no need to hydrate
    isEmptyText(node) ||
    // dynamic anchors (<!--[[-->, <!--]]-->)
    isDynamicAnchor(node) ||
    // fragment end anchor (`<!--]-->`)
    isComment(node, ']') ||
    // dynamic fragment anchors
    (__DEV__
      ? // v-if anchor (`<!--if-->`)
        isComment(node, 'if') ||
        // v-for anchor (`<!--for-->`)
        isComment(node, 'for') ||
        // v-slot anchor (`<!--slot-->`)
        isComment(node, 'slot') ||
        // dynamic-component anchor (`<!--dynamic-component-->`)
        isComment(node, 'dynamic-component')
      : isComment(node, '$'))
  )
}

export function nextSiblingAnchor(
  node: Node,
  anchorLabel: string,
): Comment | null {
  node = handleWrappedNode(node)

  let n = node.nextSibling
  while (n) {
    if (isComment(n, anchorLabel)) return n
    n = n.nextSibling
  }

  return null
}

function handleWrappedNode(node: Node): Node {
  // process dynamic node (<!--[[-->...<!--]]-->) as a single one
  if (isComment(node, '[[')) {
    return locateEndAnchor(node, '[[', ']]')!
  }

  // process fragment (<!--[-->...<!--]-->) as a single one
  else if (isComment(node, '[')) {
    return locateEndAnchor(node)!
  }

  return node
}
