import { type Block, isBlock } from '../block'
import { isArray } from '@vue/shared'

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
  return node.childNodes[i]
}

/*! #__NO_SIDE_EFFECTS__ */
export function next(node: Node): Node {
  return node.nextSibling!
}

type NodeChildAtom = Block | string | number | boolean | null | undefined | void

export type NodeArrayChildren = Array<NodeArrayChildren | NodeChildAtom>

export type NodeChild = NodeChildAtom | NodeArrayChildren

export function normalizeNode(node: NodeChild): Block {
  if (node == null || typeof node === 'boolean') {
    return []
  } else if (isArray(node) && node.length) {
    return node.map(normalizeNode)
  } else if (isBlock(node)) {
    return node
  } else {
    // strings and numbers
    return createTextNode(String(node))
  }
}
