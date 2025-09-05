import { isComment, isHydrating, locateEndAnchor } from './dom/hydration'

export let insertionParent: ParentNode | undefined
export let insertionAnchor: Node | 0 | undefined | null

const staticChildNodes = new WeakMap<ParentNode, ChildNode[]>()
export let currentStaticChildren: ChildNode[] | undefined

export interface ChildItem extends ChildNode {
  $idx: number
}
type HydrationContext = {
  prevDynamicCount: number
  children: ChildItem[]
  insertAnchors: Map<Node, number> | null
  lastAppendNode: Node | null
}

const hydrationContextMap = new WeakMap<ParentNode, HydrationContext>()

/**
 * This function is called before a block type that requires insertion
 * (component, slot outlet, if, for) is created. The state is used for actual
 * insertion on client-side render, and used for node adoption during hydration.
 */
export function setInsertionState(
  parent: ParentNode,
  anchor?: Node | 0 | null | number,
): void {
  insertionParent = parent
  if (isHydrating) {
    insertionAnchor = anchor as Node
    if (!hydrationContextMap.has(parent)) {
      const children: ChildItem[] = []
      const childNodes = parent.childNodes
      const len = childNodes.length
      // pre-assign index to all nodes to allow O(1) fragment skipping later.
      for (let i = 0; i < len; i++) {
        ;(childNodes[i] as ChildItem).$idx = i
      }
      // build children, treating a fragment [ ... ] as a single node by
      // pushing only the opening '[' anchor and jumping to its matching end.
      for (let i = 0; i < len; i++) {
        const n = childNodes[i] as ChildItem
        if (isComment(n, '[')) {
          // locate end anchor, then use its pre-computed $idx to jump in O(1)
          const end = locateEndAnchor(n) as ChildItem
          i = end.$idx
        }
        children.push(n)
      }
      hydrationContextMap.set(parent, {
        prevDynamicCount: 0,
        children,
        lastAppendNode: null,
        insertAnchors: null,
      })
    }
  } else {
    // special handling append anchor value to null
    insertionAnchor =
      typeof anchor === 'number' && anchor > 0 ? null : (anchor as Node)
    if (staticChildNodes.has(parent)) {
      currentStaticChildren = staticChildNodes.get(parent)
    } else {
      const nodes = parent.childNodes
      const len = nodes.length
      currentStaticChildren = new Array(len)
      for (let i = 0; i < len; i++) {
        const node = nodes[i] as ChildItem
        node.$idx = i
        currentStaticChildren[i] = node
      }
      staticChildNodes.set(parent, currentStaticChildren)
    }
  }
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = undefined
}

export function resetStaticChildren(): void {
  currentStaticChildren = undefined
}

export function getHydrationContext(
  parent: ParentNode,
): HydrationContext | undefined {
  return hydrationContextMap.get(parent)
}
