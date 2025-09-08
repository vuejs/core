import { isHydrating } from './dom/hydration'
export type ChildItem = ChildNode & { $idx: number }
export type InsertionParent = ParentNode & { $children?: ChildItem[] }

type HydrationState = {
  logicalChildren: ChildItem[]
  prevDynamicCount: number
  insertionAnchors: Map<Node, number> | null
  appendAnchor: Node | null
}
export let insertionParent: InsertionParent | undefined
export let insertionAnchor: Node | 0 | undefined | null

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
      insertionAnchors: null,
      appendAnchor: null,
    })
  }
}

function cacheTemplateChildren(
  anchor: number | Node | null | undefined,
  parent: InsertionParent,
) {
  // special handling append anchor value to null
  insertionAnchor =
    typeof anchor === 'number' && anchor > 0 ? null : (anchor as Node)

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
