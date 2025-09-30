/* @__NO_SIDE_EFFECTS__ */

import type { ChildItem, InsertionParent } from '../insertionState'
import { isComment, locateEndAnchor } from './hydration'

export function createElement(tagName: string): HTMLElement {
  return document.createElement(tagName)
}

/* @__NO_SIDE_EFFECTS__ */
export function createTextNode(value = ''): Text {
  return document.createTextNode(value)
}

/* @__NO_SIDE_EFFECTS__ */
export function createComment(data: string): Comment {
  return document.createComment(data)
}

/* @__NO_SIDE_EFFECTS__ */
export function querySelector(selectors: string): Element | null {
  return document.querySelector(selectors)
}

/*! @__NO_SIDE_EFFECTS__ */
export function parentNode(node: Node): ParentNode | null {
  return node.parentNode
}

/* @__NO_SIDE_EFFECTS__ */
const _txt: typeof _child = _child

/**
 * Hydration-specific version of `txt`.
 */
/* @__NO_SIDE_EFFECTS__ */
const __txt = (node: ParentNode): Node => {
  let n = node.firstChild!

  // since SSR doesn't generate blank text nodes,
  // manually insert a text node as the first child
  if (!n) {
    return node.appendChild(createTextNode())
  }

  return n
}

/* @__NO_SIDE_EFFECTS__ */
export function _child(node: InsertionParent): Node {
  return node.firstChild!
}

/**
 * Hydration-specific version of `child`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function __child(node: ParentNode, logicalIndex: number = 0): Node {
  return locateChildByLogicalIndex(node as InsertionParent, logicalIndex)!
}

/* @__NO_SIDE_EFFECTS__ */
export function _nthChild(node: InsertionParent, i: number): Node {
  return node.childNodes[i]
}

/**
 * Hydration-specific version of `nthChild`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function __nthChild(node: Node, logicalIndex: number): Node {
  return locateChildByLogicalIndex(node as InsertionParent, logicalIndex)!
}

/* @__NO_SIDE_EFFECTS__ */
export function _next(node: Node): Node {
  return node.nextSibling!
}

/**
 * Hydration-specific version of `next`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function __next(node: Node, logicalIndex: number): Node {
  return locateChildByLogicalIndex(
    node.parentNode! as InsertionParent,
    logicalIndex,
  )!
}

type DelegatedFunction<T extends (...args: any[]) => any> = T & {
  impl: T
}

/* @__NO_SIDE_EFFECTS__ */
export const txt: DelegatedFunction<typeof _txt> = (...args) => {
  return txt.impl(...args)
}
txt.impl = _txt

/* @__NO_SIDE_EFFECTS__ */
export const child: DelegatedFunction<typeof _child> = (...args) => {
  return child.impl(...args)
}
child.impl = _child

/* @__NO_SIDE_EFFECTS__ */
export const next: DelegatedFunction<typeof _next> = (...args) => {
  return next.impl(...args)
}
next.impl = _next

/* @__NO_SIDE_EFFECTS__ */
export const nthChild: DelegatedFunction<typeof _nthChild> = (...args) => {
  return nthChild.impl(...args)
}
nthChild.impl = _nthChild

/**
 * Enables hydration-specific node lookup behavior.
 *
 * Temporarily switches the implementations of the exported
 * `txt`, `child`, `next`, and `nthChild` functions to their hydration-specific
 * versions (`__txt`, `__child`, `__next`, `__nthChild`). This allows traversal
 * logic to correctly handle SSR comment anchors during hydration.
 */
export function enableHydrationNodeLookup(): void {
  txt.impl = __txt
  child.impl = __child as typeof _child
  next.impl = __next as typeof _next
  nthChild.impl = __nthChild as any as typeof _nthChild
}

export function disableHydrationNodeLookup(): void {
  txt.impl = _txt
  child.impl = _child
  next.impl = _next
  nthChild.impl = _nthChild
}

export function locateChildByLogicalIndex(
  parent: InsertionParent,
  logicalIndex: number,
): Node | null {
  let child = (parent.$llc || parent.firstChild) as ChildItem
  let fromIndex = child.$idx || 0

  while (child) {
    if (fromIndex === logicalIndex) {
      child.$idx = logicalIndex
      return (parent.$llc = child)
    }

    child = (
      isComment(child, '[')
        ? // fragment start: jump to the node after the matching end anchor
          locateEndAnchor(child)!.nextSibling
        : child.nextSibling
    ) as ChildItem

    fromIndex++
  }

  return null
}
