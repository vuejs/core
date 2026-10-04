import { type Namespace, Namespaces } from '@vue/shared'
import type { InsertionParent } from '../insertionState'
import {
  isHydrating,
  nextLogicalSibling,
  resolveBlankTextTarget,
  skipUntrackedAnchors,
} from './hydration'

const SVG_NS = 'http://www.w3.org/2000/svg'
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'

/*@__NO_SIDE_EFFECTS__*/
export function createElement(tagName: string, ns?: Namespace): HTMLElement {
  return ns
    ? (document.createElementNS(
        ns === Namespaces.SVG ? SVG_NS : MATHML_NS,
        tagName,
      ) as HTMLElement)
    : document.createElement(tagName)
}

let t: HTMLTemplateElement

export function parseTemplate(html: string, ns?: Namespace): Node {
  t = t || document.createElement('template')
  if (ns) {
    const tag = ns === Namespaces.SVG ? 'svg' : 'math'
    t.innerHTML = `<${tag}>${html}</${tag}>`
    return _child(_child(t.content) as ParentNode)
  }
  t.innerHTML = html
  return _child(t.content)
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
export function child(node: InsertionParent, isText?: boolean): Node {
  if (isHydrating) {
    const n = locateChildByLogicalIndex(node, 0)
    return isText ? resolveBlankTextTarget(n, node) : n!
  }
  return _child(node)
}

/*@__NO_SIDE_EFFECTS__*/
export function nthChild(
  node: InsertionParent,
  i: number,
  isText?: boolean,
): Node {
  if (isHydrating) {
    const n = locateChildByLogicalIndex(node, i)
    return isText ? resolveBlankTextTarget(n, node) : n!
  }
  return node.childNodes[i]
}

/*@__NO_SIDE_EFFECTS__*/
export function next(node: Node, isText?: boolean): Node {
  if (isHydrating) {
    let result = nextLogicalSibling(node)
    const parent = node.parentNode
    if (isText) result = resolveBlankTextTarget(result, parent!)
    // advance the $llc cache when `node` is the cached logical child; the
    // helper keeps `$lli` in step for us
    if (parent) updateLastLocatedLogicalChild(parent, node, result, 1)
    return result!
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

// Parents holding a `$llc` in the current hydration pass. The cache is only
// meaningful while the pass walks the DOM: released when the outermost pass
// ends, so no node keeps an unmounted subtree alive or feeds a later pass a
// stale position.
const cachedParents: InsertionParent[] = []

export function setLastLocatedLogicalChild(
  parent: InsertionParent,
  child: Node,
  logicalIndex: number,
): void {
  if (parent.$llc === undefined) cachedParents.push(parent)
  parent.$llc = child
  parent.$lli = logicalIndex
}

export function releaseLocatorCache(): void {
  for (let i = 0; i < cachedParents.length; i++) {
    cachedParents[i].$llc = undefined
  }
  cachedParents.length = 0
}

export function locateChildByLogicalIndex(
  parent: InsertionParent,
  logicalIndex: number,
): Node | null {
  let child: Node | null
  let fromIndex: number
  if (parent.$llc) {
    child = parent.$llc
    fromIndex = parent.$lli!
  } else {
    child = skipUntrackedAnchors(parent.firstChild)
    fromIndex = 0
  }

  // if target index is less than cached index, start from the beginning.
  // this can happen when child/nthChild/next updates $llc to a later node
  // before an earlier dynamic node is hydrated
  if (logicalIndex < fromIndex) {
    child = skipUntrackedAnchors(parent.firstChild)
    fromIndex = 0
  }

  while (child) {
    if (fromIndex === logicalIndex) {
      setLastLocatedLogicalChild(parent, child, logicalIndex)
      return child
    }

    child = nextLogicalSibling(child)

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
    insertionParent.$llc = to
    insertionParent.$lli! += logicalIndexOffset
  }
}
