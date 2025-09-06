import { isFragmentAnchors } from '@vue/shared'
import { isHydrating, locateEndAnchor } from './dom/hydration'
export interface ChildItem extends ChildNode {
  $idx: number
}
export let insertionParent: ParentNode | undefined
export let insertionAnchor: Node | 0 | undefined | null

const templateChildrenCache = new WeakMap<ParentNode, ChildItem[]>()
export let currentTemplateChildren: ChildItem[] | undefined

type HydrationState = {
  logicalChildren: ChildItem[]
  prevDynamicCount: number
  insertAnchors: Map<Node, number> | null
  lastAppend: Node | null
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
    initializeHydrationState(anchor, parent)
  } else {
    cacheTemplateChildren(anchor, parent)
  }
}

function initializeHydrationState(
  anchor: number | Node | null | undefined,
  parent: ParentNode,
) {
  insertionAnchor = anchor as Node
  if (!hydrationStateCache.has(parent)) {
    const childNodes = parent.childNodes
    const len = childNodes.length
    const logicalChildren = new Array(len) as ChildItem[]

    // 1. pre-assign index to all nodes to allow O(1) fragment skipping later.
    for (let i = 0; i < len; i++) {
      ;(childNodes[i] as ChildItem).$idx = i
    }

    // 2. build logical children:
    // - static node: keep the node as a child
    // - fragment: represent the whole fragment by its start anchor ('<!--[-->')
    // - vapor fragment anchors: skip them (not part of logical children)
    let index = 0
    for (let i = 0; i < len; i++) {
      const n = childNodes[i] as ChildItem
      if (n.nodeType === 8) {
        const data = (n as any as Comment).data
        if (data === '[') {
          // locate end anchor, then use its pre-computed $idx to jump in O(1)
          const end = locateEndAnchor(n as any) as ChildItem
          i = end.$idx
        }

        // vapor fragment anchors
        else if (isFragmentAnchors(data)) {
          continue
        }
      }
      n.$idx = index
      logicalChildren[index++] = n
    }
    logicalChildren.length = index
    hydrationStateCache.set(parent, {
      prevDynamicCount: 0,
      logicalChildren,
      lastAppend: null,
      insertAnchors: null,
    })
  }
}

function cacheTemplateChildren(
  anchor: number | Node | null | undefined,
  parent: ParentNode,
) {
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
