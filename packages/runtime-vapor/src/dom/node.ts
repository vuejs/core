import {
  isComment,
  isDynamicAnchor,
  isEmptyText,
  isHydrating,
  locateEndAnchor,
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
export function nthChild(node: Node, i: number): Node {
  if (!isHydrating) return node.childNodes[i]

  let n = node.firstChild!
  for (let start = 0; start < i; start++) {
    n = next(n) as ChildNode
  }
  return n
}

/*! #__NO_SIDE_EFFECTS__ */
export function next(node: Node): Node {
  if (!isHydrating) return node.nextSibling!

  // process fragment as a single node
  if (node && isComment(node, '[')) {
    node = locateEndAnchor(node)!
  }

  let n = node.nextSibling!
  // skip dynamic anchors and empty text nodes
  while (n && (isDynamicAnchor(n) || isEmptyText(n))) {
    n = n.nextSibling!
  }
  return n
}
