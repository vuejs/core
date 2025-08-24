/*! #__NO_SIDE_EFFECTS__ */

import { isHydrating } from './hydration'
import {
  CommentDraft,
  NodeRef,
  TextNodeDraft,
  type VaporNode,
  type VaporParentNode,
  isUnresolvedNode,
  toNode,
} from './nodeDraft'

export function createTextNode(value = ''): VaporNode<Text, TextNodeDraft> {
  if (isHydrating) {
    const node = new NodeRef<boolean, Text, TextNodeDraft>(TextNodeDraft)
    node.ref.textContent
    return node
  }
  return document.createTextNode(value)
}

/*! #__NO_SIDE_EFFECTS__ */
export function createComment(data: string): VaporNode<Comment, CommentDraft> {
  if (isHydrating) {
    const node = new NodeRef<boolean, Comment, CommentDraft>(CommentDraft)
    node.ref.data
    return node
  }
  return document.createComment(data)
}

/*! #__NO_SIDE_EFFECTS__ */
export function child(node: VaporParentNode): VaporNode {
  if (isUnresolvedNode(node) && !node.ref.childNodes[0]) {
    return (node.ref.childNodes[0] = new NodeRef())
  }

  return toNode(node).firstChild!
}

/*! #__NO_SIDE_EFFECTS__ */
export function nthChild(node: ParentNode, i: number): VaporNode {
  if (isUnresolvedNode(node) && !node.ref.childNodes[i]) {
    return (node.ref.childNodes[i] = new NodeRef())
  }

  return toNode(node).childNodes[i]
}

/*! #__NO_SIDE_EFFECTS__ */
export function next(node: VaporParentNode): VaporNode {
  if (isUnresolvedNode(node) && !node.ref.nextSibling) {
    const childNodes = node.ref.childNodes
    return (childNodes[childNodes.indexOf(node) + 1] = new NodeRef())
  }

  return toNode(node).nextSibling!
}
