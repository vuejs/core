/* @__NO_SIDE_EFFECTS__ */

import {
  type ChildItem,
  type InsertionParent,
  getHydrationState,
} from '../insertionState'

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
 * Hydration-specific version of `child`.
 */
/* @__NO_SIDE_EFFECTS__ */
const __txt: typeof __child = (node: ParentNode): Node => {
  let n = node.firstChild!

  // since SSR doesn't generate whitespace placeholder text nodes, if firstChild
  // is null, manually insert a text node as the first child
  if (!n) {
    return node.appendChild(createTextNode())
  }

  return n
}

/* @__NO_SIDE_EFFECTS__ */
export function _child(node: InsertionParent): Node {
  const children = node.$children
  return children ? children[0] : node.firstChild!
}

/**
 * Hydration-specific version of `child`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function __child(node: ParentNode): Node {
  return __nthChild(node, 0)!
}

/* @__NO_SIDE_EFFECTS__ */
export function _nthChild(node: InsertionParent, i: number): Node {
  const children = node.$children
  return children ? children[i] : node.childNodes[i]
}

/**
 * Hydration-specific version of `nthChild`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function __nthChild(node: Node, i: number): Node {
  const hydrationState = getHydrationState(node as ParentNode)
  if (hydrationState) {
    const { prevDynamicCount, uniqueAnchorCount, logicalChildren } =
      hydrationState
    // prevDynamicCount tracks how many dynamic nodes have been processed
    // so far (prepend/insert/append).
    // For anchor-based insert, the first time an anchor is used we adopt the
    // anchor node itself and do NOT consume the next child in `logicalChildren`,
    // yet prevDynamicCount is still incremented. This overcounts the base
    // offset by 1 per unique anchor that has appeared.
    // uniqueAnchorCount equals the number of unique anchors seen, so we
    // subtract it to neutralize those "first-use doesn't consume" cases:
    //   base = prevDynamicCount - uniqueAnchorCount
    // Then index from this base: logicalChildren[base + i].
    return logicalChildren[prevDynamicCount - uniqueAnchorCount + i]
  }
  return node.childNodes[i]
}

/* @__NO_SIDE_EFFECTS__ */
export function _next(node: Node): Node {
  const children = (node.parentNode! as InsertionParent).$children
  return children ? children[(node as ChildItem).$idx + 1] : node.nextSibling!
}

/**
 * Hydration-specific version of `next`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function __next(node: Node): Node {
  const hydrationState = getHydrationState(node.parentNode!)
  if (hydrationState) {
    const { logicalChildren } = hydrationState
    const { $idx, $uc: usedCount = 0 } = node as ChildItem
    return logicalChildren[$idx + usedCount + 1]
  }
  return node.nextSibling!
}

type DelegatedFunction<T extends (...args: any[]) => any> = T & {
  impl: T
}

/* @__NO_SIDE_EFFECTS__ */
export const txt: DelegatedFunction<typeof _txt> = node => {
  return txt.impl(node)
}
txt.impl = _child

/* @__NO_SIDE_EFFECTS__ */
export const child: DelegatedFunction<typeof _child> = node => {
  return child.impl(node)
}
child.impl = _child

/* @__NO_SIDE_EFFECTS__ */
export const next: DelegatedFunction<typeof _next> = node => {
  return next.impl(node)
}
next.impl = _next

/* @__NO_SIDE_EFFECTS__ */
export const nthChild: DelegatedFunction<typeof _nthChild> = (node, i) => {
  return nthChild.impl(node, i)
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
export function enableHydrationNodeHelper(): void {
  txt.impl = __txt
  child.impl = __child
  next.impl = __next
  nthChild.impl = __nthChild
}

export function disableHydrationNodeHelper(): void {
  txt.impl = _txt
  child.impl = _child
  next.impl = _next
  nthChild.impl = _nthChild
}
