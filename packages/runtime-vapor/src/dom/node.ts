import type { ChildItem, InsertionParent } from '../insertionState'
import {
  isHydrating,
  nextLogicalSibling,
  skipUntrackedAnchors,
} from './hydration'

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

/*@__NO_SIDE_EFFECTS__*/
export function querySelector(selectors: string): Element | null {
  return document.querySelector(selectors)
}

/* @__NO_SIDE_EFFECTS__ */
export function parentNode(node: Node): ParentNode | null {
  return node.parentNode
}

/*@__NO_SIDE_EFFECTS__*/
export function txt(node: ParentNode): Node {
  if (isHydrating) {
    // since SSR doesn't generate blank text nodes,
    // manually insert a text node as the first child
    let n = _child(node)
    if (!n) {
      return node.appendChild(createTextNode())
    }
    return n
  }
  return _child(node)
}

/*@__NO_SIDE_EFFECTS__*/
export function child(node: InsertionParent): Node {
  if (isHydrating) {
    return locateChildByLogicalIndex(node, 0)
  }
  return _child(node)
}

/*@__NO_SIDE_EFFECTS__*/
export function nthChild(node: InsertionParent, i: number): Node {
  if (isHydrating) {
    return locateChildByLogicalIndex(node, i)
  }
  return node.childNodes[i]
}

/*@__NO_SIDE_EFFECTS__*/
export function next(node: Node): Node {
  if (isHydrating) {
    const result = nextLogicalSibling(node)!
    // advance the $llc cache when `node` is the cached logical child; the
    // helper enforces the "$llc implies $idx" invariant for us
    const parent = node.parentNode
    if (parent) updateLastLocatedLogicalChild(parent, node, result, 1)
    return result
  }
  return _next(node)
}

/*@__NO_SIDE_EFFECTS__*/
export function _child(node: InsertionParent): Node {
  return node.firstChild!
}

/*@__NO_SIDE_EFFECTS__*/
export function _next(node: Node): Node {
  return node.nextSibling!
}

export function locateChildByLogicalIndex(
  parent: InsertionParent,
  logicalIndex: number,
): Node {
  let child = (parent.$llc ||
    skipUntrackedAnchors(parent.firstChild)) as ChildItem
  let fromIndex = child ? child.$idx || 0 : 0

  // if target index is less than cached index, start from the beginning.
  // this can happen when child/nthChild/next updates $llc to a later node
  // before an earlier dynamic node is hydrated
  if (child && logicalIndex < fromIndex) {
    child = skipUntrackedAnchors(parent.firstChild) as ChildItem
    fromIndex = 0
  }

  while (child) {
    if (fromIndex === logicalIndex) {
      child.$idx = logicalIndex
      return (parent.$llc = child)
    }

    child = nextLogicalSibling(child) as ChildItem

    fromIndex++
  }

  // The server rendered fewer logical children than the client expects —
  // a children mismatch, or nothing but untracked anchors left after an
  // earlier sibling trimmed its range. Seed a placeholder at the tail so the
  // regular per-node mismatch recovery rebuilds and warns in place instead
  // of crashing on a missing node.
  const placeholder = parent.appendChild(createTextNode()) as Node as ChildItem
  placeholder.$idx = logicalIndex
  return (parent.$llc = placeholder)
}

// Hydration mismatch recovery and other DOM mutations can replace or remove
// the cached node. Transfer `$llc` only when it still points to that node.
export function updateLastLocatedLogicalChild(
  parent: ParentNode,
  from: Node,
  to: Node | null,
  logicalIndexOffset = 0,
): void {
  const insertionParent = parent as InsertionParent
  if (insertionParent.$llc === from) {
    if (to) {
      ;(to as ChildItem).$idx = (from as ChildItem).$idx + logicalIndexOffset
    }
    insertionParent.$llc = to
  }
}
