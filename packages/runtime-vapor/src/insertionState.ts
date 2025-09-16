import { isHydrating } from './dom/hydration'
export type ChildItem = ChildNode & {
  $idx: number
  // used count as an anchor
  $uc?: number
}
export type InsertionParent = ParentNode & { $children?: ChildItem[] }
type HydrationState = {
  // static nodes and the start anchors of fragments
  logicalChildren: ChildItem[]
  // hydrated dynamic children count so far
  prevDynamicCount: number
  // number of unique insertion anchors that have appeared
  uniqueAnchorCount: number
  // current append anchor
  appendAnchor: Node | null
}

const hydrationStateCache = new WeakMap<ParentNode, HydrationState>()
export let insertionParent: InsertionParent | undefined
export let insertionAnchor: Node | 0 | undefined | null

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

  if (anchor !== undefined) {
    if (isHydrating) {
      insertionAnchor = anchor as Node
      initializeHydrationState(parent)
    } else {
      // special handling append anchor value to null
      insertionAnchor =
        typeof anchor === 'number' && anchor > 0 ? null : (anchor as Node)
      cacheTemplateChildren(parent)
    }
  } else {
    insertionAnchor = undefined
  }
}

function initializeHydrationState(parent: ParentNode) {
  if (!hydrationStateCache.has(parent)) {
    const childNodes = parent.childNodes
    const len = childNodes.length
    const logicalChildren = new Array(len) as ChildItem[]
    // Build logical children:
    // - static node: keep the node as a child
    // - fragment: keep only the start anchor ('<!--[-->') as a child
    let index = 0
    for (let i = 0; i < len; i++) {
      const n = childNodes[i] as ChildItem
      if (n.nodeType === 8) {
        const data = (n as any as Comment).data
        // vdom fragment
        if (data === '[') {
          n.$idx = index
          logicalChildren[index++] = n
          // find matching end anchor, accounting for nested fragments
          let depth = 1
          let j = i + 1
          for (; j < len; j++) {
            const c = childNodes[j] as Comment
            if (c.nodeType === 8) {
              const d = c.data
              if (d === '[') depth++
              else if (d === ']') {
                depth--
                if (depth === 0) break
              }
            }
          }
          // jump i to the end anchor
          i = j
          continue
        }
      }
      n.$idx = index
      logicalChildren[index++] = n
    }
    logicalChildren.length = index
    hydrationStateCache.set(parent, {
      logicalChildren,
      prevDynamicCount: 0,
      uniqueAnchorCount: 0,
      appendAnchor: null,
    })
  }
}

function cacheTemplateChildren(parent: InsertionParent) {
  if (!parent.$children) {
    const nodes = parent.childNodes
    const len = nodes.length
    const children = new Array(len) as ChildItem[]
    for (let i = 0; i < len; i++) {
      const node = nodes[i] as ChildItem
      node.$idx = i
      children[i] = node
    }
    parent.$children = children
  }
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = undefined
}

export function getHydrationState(
  parent: ParentNode,
): HydrationState | undefined {
  return hydrationStateCache.get(parent)
}
