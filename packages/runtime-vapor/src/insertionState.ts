import { isComment, isHydrating } from './dom/hydration'
import { currentTemplateFn, resetTemplateFn } from './dom/template'
export type ChildItem = ChildNode & {
  $idx: number
  // used count as an anchor
  $uc?: number
}

export type InsertionParent = ParentNode & {
  $children?: ChildItem[]
  /**
   * hydration-specific properties
   */
  // mapping from logical index to real index in childNodes
  $idxMap?: number[]
  // hydrated dynamic children count so far
  $prevDynamicCount?: number
  // number of unique insertion anchors that have appeared
  $anchorCount?: number
  // last append index
  $appendIndex?: number | null
  // number of dynamically inserted nodes (e.g., comment anchors)
  $indexOffset?: number
}
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
      resetTemplateFn()
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

function initializeHydrationState(parent: InsertionParent) {
  if (!parent.$idxMap) {
    const childNodes = parent.childNodes
    const len = childNodes.length

    // fast path for single child case. use first child as hydration node
    // no need to build logical index map
    if (
      len === 1 ||
      (len === 3 &&
        isComment(childNodes[0], '[') &&
        isComment(childNodes[2], ']'))
    ) {
      insertionAnchor = undefined
      return
    }

    if (currentTemplateFn) {
      if (currentTemplateFn.$idxMap) {
        const idxMap = (parent.$idxMap = currentTemplateFn.$idxMap)
        // set $idx to childNodes
        for (let i = 0; i < idxMap.length; i++) {
          ;(childNodes[idxMap[i]] as ChildItem).$idx = i
        }
      } else {
        parent.$idxMap = currentTemplateFn.$idxMap = buildLogicalIndexMap(
          len,
          childNodes,
        )
      }
    } else {
      parent.$idxMap = buildLogicalIndexMap(len, childNodes)
    }
    parent.$prevDynamicCount = 0
    parent.$anchorCount = 0
    parent.$appendIndex = null
    parent.$indexOffset = 0
  }
}

function buildLogicalIndexMap(len: number, childNodes: NodeListOf<ChildNode>) {
  const idxMap = new Array() as number[]
  // Build logical index map:
  // - static node: map logical index to real index
  // - fragment: map logical index to start anchor's real index
  let logicalIndex = 0
  for (let i = 0; i < len; i++) {
    const n = childNodes[i] as ChildItem
    n.$idx = logicalIndex
    if (n.nodeType === 8) {
      const data = (n as any as Comment).data
      // vdom fragment
      if (data === '[') {
        idxMap[logicalIndex++] = i
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
    idxMap[logicalIndex++] = i
  }
  return idxMap
}

function cacheTemplateChildren(parent: InsertionParent) {
  if (!parent.$children) {
    const nodes = parent.childNodes
    const len = nodes.length
    if (len === 0) return

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

export function incrementIndexOffset(parent: InsertionParent): void {
  if (parent.$indexOffset !== undefined) {
    parent.$indexOffset++
  }
}
