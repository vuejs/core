/*! #__NO_SIDE_EFFECTS__ */

import {
  type ChildItem,
  currentStaticChildren,
  getHydrationContext,
} from '../insertionState'

export function createElement(tagName: string): HTMLElement {
  return document.createElement(tagName)
}

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

export interface StaticNode extends Element {
  $sc?: Node[]
  $index?: number
}

export function initStaticSnapshots(root: StaticNode & { $sc?: Node[] }): void {
  const stack: StaticNode[] = [root]
  while (stack.length) {
    const cur = stack.pop()!
    const list: Node[] = []
    cur.childNodes.forEach((n, i) => {
      ;(n as StaticNode).$index = i
      list.push(n)
      if (n.nodeType === 1) {
        stack.push(n as StaticNode)
      }
    })
    cur.$sc = list
  }
}

/*! #__NO_SIDE_EFFECTS__ */
const _txt: typeof _child = _child

/**
 * Hydration-specific version of `child`.
 */
/*! #__NO_SIDE_EFFECTS__ */
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

/*! #__NO_SIDE_EFFECTS__ */
export function _child(node: ParentNode): Node {
  return currentStaticChildren ? currentStaticChildren[0] : node.firstChild!
}

/**
 * Hydration-specific version of `child`.
 */
/*! #__NO_SIDE_EFFECTS__ */
export function __child(node: ParentNode & { $lpn?: Node }): Node {
  return __nthChild(node, 0)!
}

/*! #__NO_SIDE_EFFECTS__ */
export function _nthChild(node: Node, i: number): Node {
  return currentStaticChildren ? currentStaticChildren[i] : node.childNodes[i]
}

/**
 * Hydration-specific version of `nthChild`.
 */
/*! #__NO_SIDE_EFFECTS__ */
export function __nthChild(node: Node, i: number): Node {
  const hydrationContext = getHydrationContext(node as ParentNode)
  if (hydrationContext) {
    const { prevDynamicCount, insertAnchors, children } = hydrationContext
    return children[
      prevDynamicCount - (insertAnchors ? insertAnchors.size : 0) + i
    ]
  }
  return node.childNodes[i]
}

/*! #__NO_SIDE_EFFECTS__ */
export function _next(node: Node): Node {
  if (currentStaticChildren) {
    return currentStaticChildren[(node as ChildItem).$idx + 1]
  }
  return node.nextSibling!
}

/**
 * Hydration-specific version of `next`.
 */
/*! #__NO_SIDE_EFFECTS__ */
export function __next(node: Node): Node {
  const hydrationContext = getHydrationContext(node.parentNode!)
  if (hydrationContext) {
    const { children, insertAnchors } = hydrationContext
    const seenCount = (insertAnchors && insertAnchors.get(node)) || 0
    // If node is used as an anchor, the first hydration uses node itself,
    // so insertNodesCount needs -1
    const insertNodesCount = seenCount === 0 ? 0 : seenCount - 1
    return children[(node as ChildItem).$idx + insertNodesCount + 1]
  }
  return node.nextSibling!
}

type DelegatedFunction<T extends (...args: any[]) => any> = T & {
  impl: T
}

/*! #__NO_SIDE_EFFECTS__ */
export const txt: DelegatedFunction<typeof _txt> = node => {
  return txt.impl(node)
}
txt.impl = _child

/*! #__NO_SIDE_EFFECTS__ */
export const child: DelegatedFunction<typeof _child> = node => {
  return child.impl(node)
}
child.impl = _child

/*! #__NO_SIDE_EFFECTS__ */
export const next: DelegatedFunction<typeof _next> = node => {
  return next.impl(node)
}
next.impl = _next

/*! #__NO_SIDE_EFFECTS__ */
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
