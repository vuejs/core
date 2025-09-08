/* @__NO_SIDE_EFFECTS__ */

import {
  type ChildItem,
  getHydrationState,
  getTemplateChildren,
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
    node.textContent = ' '
    return node.firstChild!
  }

  return n
}

/* @__NO_SIDE_EFFECTS__ */
export function _child(node: ParentNode): Node {
  const templateChildren = getTemplateChildren(node)
  return templateChildren ? templateChildren[0] : node.firstChild!
}

/**
 * Hydration-specific version of `child`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function __child(node: ParentNode & { $lpn?: Node }): Node {
  return __nthChild(node, 0)!
}

/* @__NO_SIDE_EFFECTS__ */
export function _nthChild(node: Node, i: number): Node {
  const templateChildren = getTemplateChildren(node as ParentNode)
  return templateChildren ? templateChildren[i] : node.childNodes[i]
}

/**
 * Hydration-specific version of `nthChild`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function __nthChild(node: Node, i: number): Node {
  const hydrationState = getHydrationState(node as ParentNode)
  if (hydrationState) {
    const { prevDynamicCount, insertionAnchors, logicalChildren } =
      hydrationState
    // prevDynamicCount tracks how many dynamic nodes have been processed
    // so far (prepend/insert/append).
    // For anchor-based insert, the first time an anchor is used we adopt the
    // anchor node itself and do NOT consume the next child in `logicalChildren`,
    // yet prevDynamicCount is still incremented. This overcounts the base
    // offset by 1 per unique anchor that has appeared.
    // insertionAnchors.size equals the number of unique anchors seen, so we
    // subtract it to neutralize those "first-use doesn't consume" cases:
    //   base = prevDynamicCount - insertionAnchors.size
    // Then index from this base: logicalChildren[base + i].
    const size = insertionAnchors ? insertionAnchors.size : 0
    return logicalChildren[prevDynamicCount - size + i]
  }
  return node.childNodes[i]
}

/* @__NO_SIDE_EFFECTS__ */
export function _next(node: Node): Node {
  const templateChildren = getTemplateChildren(node.parentNode!)
  return templateChildren
    ? templateChildren[(node as ChildItem).$idx + 1]
    : node.nextSibling!
}

/**
 * Hydration-specific version of `next`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function __next(node: Node): Node {
  const hydrationState = getHydrationState(node.parentNode!)
  if (hydrationState) {
    const { logicalChildren, insertionAnchors } = hydrationState
    const seenCount = (insertionAnchors && insertionAnchors.get(node)) || 0
    // If node is used as an anchor, the first hydration uses node itself,
    // but seenCount increases, so here needs -1
    const insertedNodesCount = seenCount === 0 ? 0 : seenCount - 1
    return logicalChildren[(node as ChildItem).$idx + insertedNodesCount + 1]
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
export function enableHydrationNodeLookup(): void {
  txt.impl = __txt
  child.impl = __child
  next.impl = __next
  nthChild.impl = __nthChild
}

export function disableHydrationNodeLookup(): void {
  txt.impl = _txt
  child.impl = _child
  next.impl = _next
  nthChild.impl = _nthChild
}
