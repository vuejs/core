import type { ChildItem, InsertionParent } from '../insertionState'
import { isHydrating, nextLogicalSibling } from './hydration'

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
export function child(node: InsertionParent, logicalIndex?: number): Node {
  if (isHydrating) {
    return locateChildByLogicalIndex(node, logicalIndex ?? 0)!
  }
  return _child(node)
}

/*@__NO_SIDE_EFFECTS__*/
export function nthChild(
  node: InsertionParent,
  i: number,
  logicalIndex: number = i,
): Node {
  if (isHydrating) {
    return locateChildByLogicalIndex(node, logicalIndex)!
  }
  return node.childNodes[i]
}

/*@__NO_SIDE_EFFECTS__*/
export function next(node: Node, logicalIndex?: number): Node {
  if (isHydrating) {
    return locateChildByLogicalIndex(
      node.parentNode! as InsertionParent,
      logicalIndex!,
    )!
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
): Node | null {
  let child = (parent.$llc || parent.firstChild) as ChildItem
  let fromIndex = child.$idx || 0

  // if target index is less than cached index, start from the beginning.
  // this can happen when child/nthChild/next updates $llc to a later node
  // before an earlier dynamic node is hydrated
  if (logicalIndex < fromIndex) {
    child = parent.firstChild as ChildItem
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

  return null
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
