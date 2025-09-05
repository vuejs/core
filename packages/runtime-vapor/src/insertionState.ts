import { isComment, isHydrating, locateEndAnchor } from './dom/hydration'

export let insertionParent: ParentNode | undefined
export let insertionAnchor: Node | 0 | undefined | null

const staticChildNodes = new WeakMap<ParentNode, ChildNode[]>()
export let currentStaticChildren: ChildNode[] | undefined

type HydrationContext = {
  dynamicCount: number
  insertCount: number
  nodes: ChildNode[]
  insertAnchor: Node | null
  seenInsertAnchors: Set<Node> | null
  appendAnchor: Node | null
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
      const nodes: ChildNode[] = []
      const childNodes = Array.from(parent.childNodes)
      for (let i = 0; i < childNodes.length; i++) {
        const n = childNodes[i]
        if (isComment(n, '[')) {
          // process vdom fragment as single node
          // TODO: perf locateEndAnchorIndex
          const end = locateEndAnchor(n)
          i = childNodes.indexOf(end as ChildNode, i)
        }
        nodes.push(n)
      }
      hydrationContextMap.set(parent, {
        dynamicCount: 0,
        insertCount: 0,
        nodes,
        appendAnchor: null,
        insertAnchor: null,
        seenInsertAnchors: null,
      })
    }
  } else {
    // special handling append anchor value to null
    insertionAnchor =
      typeof anchor === 'number' && anchor > 0 ? null : (anchor as Node)
    // cache the static child nodes
    if (staticChildNodes.has(parent)) {
      currentStaticChildren = staticChildNodes.get(parent)
    } else {
      staticChildNodes.set(
        parent,
        // TODO: perf avoid Array.from?
        (currentStaticChildren = Array.from(parent.childNodes)),
      )
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
