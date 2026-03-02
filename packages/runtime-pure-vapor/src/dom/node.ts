import type { InsertionParent } from '../insertionState'

/*@__NO_SIDE_EFFECTS__*/
export function createElement(tagName: string): HTMLElement {
  return document.createElement(tagName)
}

/*@__NO_SIDE_EFFECTS__*/
export function createTextNode(value = ''): Text {
  return document.createTextNode(value)
}

/*@__NO_SIDE_EFFECTS__*/
export function createComment(data: string): Comment {
  return document.createComment(data)
}

type Anchor = Comment & {
  // cached matching fragment end to avoid repeated traversal
  // on nested fragments
  $fe?: Anchor
}
/** 从水合移过来的函数，似乎有用 */
export const isComment = (node: Node, data: string): node is Anchor =>
  node.nodeType === 8 && (node as Comment).data === data

/*@__NO_SIDE_EFFECTS__*/
export function querySelector(selectors: string): Element | null {
  return document.querySelector(selectors)
}

/* @__NO_SIDE_EFFECTS__ */
export function parentNode(node: Node): ParentNode | null {
  return node.parentNode
}

/*@__NO_SIDE_EFFECTS__*/
export function child(node: InsertionParent): Node {
  return node.firstChild!
}
/*@__NO_SIDE_EFFECTS__*/
export const txt: typeof child = child

/*@__NO_SIDE_EFFECTS__*/
export function nthChild(node: InsertionParent, i: number): Node {
  return node.childNodes[i]
}

/*@__NO_SIDE_EFFECTS__*/
export function next(node: Node): Node {
  return node.nextSibling!
}
