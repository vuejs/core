/**
 * 在创建需要插入的块（组件、插槽、条件渲染、列表渲染）之前，调用 setInsertionState() 记录插入上下文
- 根据是否在 hydration 模式，决定使用逻辑索引还是锚点进行定位
- 插入完成后调用 resetInsertionState() 清理状态
 */
export type ChildItem = ChildNode & {
  // 逻辑索引，在 hydration 期间用于定位节点
  $idx: number
}

export type InsertionParent = ParentNode & {
  // 缓存第一个子节点，用于可能的连续前置插入
  $fc?: Node | null

  // 最后定位的逻辑子节点
  $llc?: Node | null
}
export let insertionParent: InsertionParent | undefined
export let insertionAnchor: Node | 0 | undefined | null

// 指示该插入是否是父节点中的最后一个。
// 如果为 true，表示在此插入之后不再需要 hydrate 更多节点，
// 将当前 hydration 节点推进到父节点的 nextSibling
export let isLastInsertion: boolean | undefined

/**
 * 此函数在需要插入的块类型（组件、插槽出口、if、for）创建之前被调用。
 * 不需要逻辑位置了，保留以避免大量修改。
 */
export function setInsertionState(
  parent: ParentNode & { $fc?: Node | null },
  anchor?: Node | 0 | null,
  logicalIndex?: number,
  last?: boolean,
): void {
  insertionParent = parent
  isLastInsertion = last

  if (anchor !== undefined) {
    insertionAnchor = anchor
    if (anchor === 0 && !parent.$fc) {
      parent.$fc = parent.firstChild
    }
  } else {
    insertionAnchor = undefined
  }
}

export function resetInsertionState(): void {
  insertionParent = insertionAnchor = isLastInsertion = undefined
}
