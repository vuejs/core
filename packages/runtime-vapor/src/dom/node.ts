import { advanceToNonBlockNode } from './hydration'
import { isBlockStartAnchor } from '@vue/shared'

/*! #__NO_SIDE_EFFECTS__ */
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
  return node.firstChild!
}

/**
 * Hydration-specific version of `child`.
 */
/*! #__NO_SIDE_EFFECTS__ */
export function __child(node: ParentNode): Node {
  let n: Node = node.firstChild!
  while (n && isBlockStartAnchor(n)) {
    n = advanceToNonBlockNode(n)
    n = n.nextSibling!
  }

  return n
}

/*! #__NO_SIDE_EFFECTS__ */
export function _nthChild(node: Node, i: number): Node {
  return node.childNodes[i]
}

/**
 * Hydration-specific version of `nthChild`.
 */
/*! #__NO_SIDE_EFFECTS__ */
export function __nthChild(node: Node, i: number): Node {
  let n = __child(node as ParentNode)
  for (let start = 0; start < i; start++) {
    n = __next(n) as ChildNode
  }
  return n
}

/*! #__NO_SIDE_EFFECTS__ */
export function _next(node: Node): Node {
  return node.nextSibling!
}

/**
 * Hydration-specific version of `next`.
 */
/*! #__NO_SIDE_EFFECTS__ */
export function __next(node: Node): Node {
  if (isBlockStartAnchor(node)) {
    node = advanceToNonBlockNode(node)
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
