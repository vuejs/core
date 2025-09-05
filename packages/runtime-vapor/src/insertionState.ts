import { isComment, isHydrating, locateEndAnchor } from './dom/hydration'
export interface ChildItem extends ChildNode {
  $idx: number
}
export let insertionParent: ParentNode | undefined
export let insertionAnchor: Node | 0 | undefined | null

const templateChildrenCache = new WeakMap<ParentNode, ChildItem[]>()
export let currentTemplateChildren: ChildItem[] | undefined

type HydrationState = {
  prevDynamicCount: number
  children: ChildItem[]
  insertAnchors: Map<Node, number> | null
  lastAppendNode: Node | null
}

const hydrationStateCache = new WeakMap<ParentNode, HydrationState>()

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
    if (!hydrationStateCache.has(parent)) {
      const childNodes = parent.childNodes
      const len = childNodes.length
      const children = new Array(len) as ChildItem[]

      // 1. pre-assign index to all nodes to allow O(1) fragment skipping later.
      for (let i = 0; i < len; i++) {
        ;(childNodes[i] as ChildItem).$idx = i
      }

      // 2. build children, treating a fragment [ ... ] as a single node
      let index = 0
      for (let i = 0; i < len; i++) {
        const n = childNodes[i] as ChildItem
        if (isComment(n, '[')) {
          // locate end anchor, then use its pre-computed $idx to jump in O(1)
          const end = locateEndAnchor(n) as ChildItem
          i = end.$idx
        }
        n.$idx = index
        children[index++] = n
      }
      children.length = index

      hydrationStateCache.set(parent, {
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
    if (templateChildrenCache.has(parent)) {
      currentTemplateChildren = templateChildrenCache.get(parent)
    } else {
      const nodes = parent.childNodes
      const len = nodes.length
      currentTemplateChildren = new Array(len)
      for (let i = 0; i < len; i++) {
        const node = nodes[i] as ChildItem
        node.$idx = i
        currentTemplateChildren[i] = node
      }
      templateChildrenCache.set(parent, currentTemplateChildren)
    }
  }
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = undefined
}

export function getTemplateChildren(
  parent: ParentNode,
): ChildItem[] | undefined {
  return templateChildrenCache.get(parent)
}

export function getHydrationState(
  parent: ParentNode,
): HydrationState | undefined {
  return hydrationStateCache.get(parent)
}
