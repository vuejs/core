/*! #__NO_SIDE_EFFECTS__ */

import { isComment, isHydrating } from './hydration'

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
  return node.childNodes[i]
}

/*! #__NO_SIDE_EFFECTS__ */
export function next(node: Node): Node {
  let n = node.nextSibling!
  if (isHydrating) {
    // skip dynamic anchors and empty text nodes
    while (n && (isDynamicAnchor(n) || isEmptyText(n))) {
      n = n.nextSibling!
    }
  }
  return n
}

function isDynamicAnchor(node: Node): node is Comment {
  return isComment(node, '[[') || isComment(node, ']]')
}

function isEmptyText(node: Node): node is Text {
  return node.nodeType === 3 && !(node as Text).data.trim()
}
