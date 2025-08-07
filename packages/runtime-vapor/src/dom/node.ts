import { isComment, isNonHydrationNode, locateEndAnchor } from './hydration'
import {
  DYNAMIC_END_ANCHOR_LABEL,
  DYNAMIC_START_ANCHOR_LABEL,
  isVaporAnchors,
} from '@vue/shared'

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
export function _child(node: ParentNode): Node {
  return node.firstChild!
}

/**
 * Hydration-specific version of `child`.
 *
 * This function skips leading fragment anchors to find the first node relevant
 * for hydration matching against the client-side template structure.
 *
 * Problem:
 *   Template: `<div><slot />{{ msg }}</div>`
 *
 *   Client Compiled Code (Simplified):
 *     const n2 = t0() // n2 = `<div> </div>`
 *     const n1 = _child(n2, 1) // n1 = text node
 *     // ... slot creation ...
 *     _renderEffect(() => _setText(n1, _ctx.msg))
 *
 *   SSR Output: `<div><!--[-->slot content<!--]-->Actual Text Node</div>`
 *
 *   Hydration Mismatch:
 *   - During hydration, `n2` refers to the SSR `<div>`.
 *   - `_child(n2, 1)` would return `<!--[-->`.
 *   - The client code expects `n1` to be the text node, but gets the comment.
 *     The subsequent `_setText(n1, ...)` would fail or target the wrong node.
 *
 *   Solution (`__child`):
 *   - `__child(n2, offset)` is used during hydration. It skips the dynamic children
 *     to find the "Actual Text Node", correctly matching the client's expectation
 *     for `n1`.
 */
/*! #__NO_SIDE_EFFECTS__ */
export function __child(node: ParentNode, offset?: number): Node {
  // when offset is -1, it means we need to get the text node of this element
  // since server-side rendering doesn't generate whitespace placeholder text nodes,
  // if firstChild is null, manually insert a text node and return it
  if (offset === -1 && !node.firstChild) {
    node.textContent = ' '
    return node.firstChild!
  }

  let n = offset ? __nthChild(node, offset) : node.firstChild!
  while (n && (isComment(n, '[') || isVaporAnchors(n))) {
    if (isComment(n, '[')) {
      n = locateEndAnchor(n)!.nextSibling!
    } else {
      n = n.nextSibling!
    }
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
  let n = node.firstChild!
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
 *
 * SSR comment anchors (fragments `<!--[-->...<!--]-->`, dynamic `<!--[[-->...<!--]]-->`)
 * disrupt standard `node.nextSibling` traversal during hydration. `_next` might
 * return a comment node or an internal node of a fragment instead of skipping
 * the entire fragment block.
 *
 * Example:
 *   Template: `<div>Node1<!>Node2</div>` (where <!> is a dynamic component placeholder)
 *
 *   Client Compiled Code (Simplified):
 *     const n2 = t0() // n2 = `<div>Node1<!---->Node2</div>`
 *     const n1 = _next(_child(n2)) // n1 = _next(Node1) returns `<!---->`
 *     _setInsertionState(n2, n1) // insertion anchor is `<!---->`
 *     const n0 = _createComponent(_ctx.Comp) // inserted before `<!---->`
 *
 *   SSR Output: `<div>Node1<!--[-->Node3 Node4<!--]-->Node2</div>`
 *
 *   Hydration Mismatch:
 *   - During hydration, `n2` refers to the SSR `<div>`.
 *   - `_child(n2)` returns `Node1`.
 *   - `_next(Node1)` would return `<!--[-->`.
 *   - The client logic expects `n1` to be the node *after* `Node1` in its structure
 *     (the placeholder), but gets the fragment start anchor `<!--[-->` from SSR.
 *   - Using `<!--[-->` as the insertion anchor for hydrating the component is incorrect.
 *
 *   Solution (`__next`):
 *   - During hydration, `next.impl` is `__next`.
 *   - `n1 = __next(Node1)` is called.
 *   - `__next` recognizes that the immediate sibling `<!--[-->` is a fragment start anchor.
 *   - It skips the entire fragment block (`<!--[-->Node3 Node4<!--]-->`).
 *   - It returns the node immediately *after* the fragment's end anchor, which is `Node2`.
 *   - This correctly identifies the logical "next sibling" anchor (`Node2`) in the SSR structure,
 *     allowing the component to be hydrated correctly relative to `Node1` and `Node2`.
 *
 * This function ensures traversal correctly skips over non-hydration nodes and
 * treats entire fragment/dynamic blocks (when starting *from* their beginning anchor)
 * as single logical units to find the next actual sibling node for hydration matching.
 */
/*! #__NO_SIDE_EFFECTS__ */
export function __next(node: Node): Node {
  // process dynamic node (<!--[[-->...<!--]]-->) as a single node
  if (isComment(node, DYNAMIC_START_ANCHOR_LABEL)) {
    node = locateEndAnchor(
      node,
      DYNAMIC_START_ANCHOR_LABEL,
      DYNAMIC_END_ANCHOR_LABEL,
    )!
  }

  // process fragment (<!--[-->...<!--]-->) as a single node
  else if (isComment(node, '[')) {
    node = locateEndAnchor(node)!
  }

  let n = node.nextSibling!
  while (n && isNonHydrationNode(n)) {
    n = n.nextSibling!
  }
  return n
}

type DelegatedFunction<T extends (...args: any[]) => any> = T & {
  impl: T
}

/*! #__NO_SIDE_EFFECTS__ */
export const child: DelegatedFunction<typeof __child> = (node, offset) => {
  return child.impl(node, offset)
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
 * `child`, `next`, and `nthChild` functions to their hydration-specific
 * versions (`__child`, `__next`, `__nthChild`). This allows traversal
 * logic to correctly handle SSR comment anchors during hydration.
 */
export function enableHydrationNodeLookup(): void {
  child.impl = __child
  next.impl = __next
  nthChild.impl = __nthChild
}

export function disableHydrationNodeLookup(): void {
  child.impl = _child
  next.impl = _next
  nthChild.impl = _nthChild
}
