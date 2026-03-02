/** 这是 Vue.js Vapor 模式（纯编译时渲染模式）的核心模块，负责管理 Block（块） 的生命周期操作。

### 核心功能
1. Block 类型定义
   
   - Block 可以是 DOM 节点、片段(Fragment)、动态片段、组件实例或 Block 数组
   - TransitionBlock 支持过渡动画的 Block 类型
2. 核心操作方法
   
   - insert() - 将 Block 插入到父节点中（支持过渡动画）
   - move() - 移动 Block 到新的位置（支持过渡动画）
   - remove() - 移除 Block（支持过渡动画）
   - prepend() - 在父节点开头插入多个 Block
3. 辅助功能
   
   - isBlock() / isValidBlock() - 类型检查
   - normalizeBlock() - 将 Block 规范化为一组 DOM 节点（仅开发/测试使用）
   - findBlockNode() - 查找 Block 的父节点和下一个兄弟节点
   - isFragmentBlock() - 判断是否为片段类型的 Block
4. CSS Scoped 支持
   
   - setScopeId() - 为 Block 设置 CSS scoped 属性
   - setComponentScopeId() - 为组件实例设置 scopeId，支持继承父级 scopeId
5. 过渡动画钩子注册
   
   - registerTransitionHooks() - 注册过渡钩子（用于 tree-shaking）
   - applyTransitionHooks() / applyTransitionLeaveHooks() - 应用过渡钩子
### 设计特点
- 递归处理：支持嵌套的组件和片段结构
- 过渡动画集成：与 Vue 的 Transition 组件深度集成
- Tree-shaking 友好：过渡钩子采用注册模式，未使用时可以被 tree-shaking 
*/
import { isArray } from '@vue/shared'
import {
  type VaporComponentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { child } from './dom/node'
import { isComment } from './dom/node'
import {
  MoveType,
  type TransitionHooks,
  type TransitionProps,
  type TransitionState,
  getInheritedScopeIds,
  performTransitionEnter,
  performTransitionLeave,
} from '@vue/runtime-dom'
import {
  type DynamicFragment,
  type VaporFragment,
  isFragment,
} from './fragment'
import { isTeleportFragment } from './components/Teleport'

export interface VaporTransitionHooks extends TransitionHooks {
  state: TransitionState
  props: TransitionProps
  instance: VaporComponentInstance
  // 标记过渡钩子为禁用状态
  disabled?: boolean
}

export interface TransitionOptions {
  $key?: any
  $transition?: VaporTransitionHooks
}

export type TransitionBlock = (
  | Node
  | VaporFragment
  | DynamicFragment
  | VaporComponentInstance
) &
  TransitionOptions

export type Block =
  | Node
  | VaporFragment
  | DynamicFragment
  | VaporComponentInstance
  | Block[]
export type BlockFn = (...args: any[]) => Block

export function isBlock(val: NonNullable<unknown>): val is Block {
  return (
    val instanceof Node ||
    isArray(val) ||
    isVaporComponent(val) ||
    isFragment(val)
  )
}

export function isValidBlock(block: Block): boolean {
  if (block instanceof Node) {
    return !(block instanceof Comment)
  } else if (isVaporComponent(block)) {
    return isValidBlock(block.block)
  } else if (isArray(block)) {
    return block.length > 0 && block.some(isValidBlock)
  } else {
    // 片段
    return isValidBlock(block.nodes)
  }
}

export function insert(
  block: Block,
  parent: ParentNode & { $fc?: Node | null },
  anchor: Node | null | 0 = null, // 0 means prepend
  parentSuspense?: any, // TODO Suspense
): void {
  anchor = anchor === 0 ? parent.$fc || child(parent) : anchor
  if (block instanceof Node) {
    // 仅在元素节点上应用过渡效果
    if (
      block instanceof Element &&
      (block as TransitionBlock).$transition &&
      !(block as TransitionBlock).$transition!.disabled
    ) {
      performTransitionEnter(
        block,
        (block as TransitionBlock).$transition as TransitionHooks,
        () => parent.insertBefore(block, anchor as Node),
        parentSuspense,
      )
    } else {
      parent.insertBefore(block, anchor)
    }
  } else if (isVaporComponent(block)) {
    if (block.isMounted && !block.isDeactivated) {
      insert(block.block!, parent, anchor)
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (const b of block) {
      insert(b, parent, anchor)
    }
  } else {
    if (block.anchor) {
      insert(block.anchor, parent, anchor)
      anchor = block.anchor
    }
    // 片段
    if (block.insert) {
      block.insert(parent, anchor, (block as TransitionBlock).$transition)
    } else {
      insert(block.nodes, parent, anchor, parentSuspense)
    }
  }
}

export function move(
  block: Block,
  parent: ParentNode & { $fc?: Node | null },
  anchor: Node | null | 0 = null, // 0 means prepend
  moveType: MoveType = MoveType.LEAVE,
  parentComponent?: VaporComponentInstance,
  parentSuspense?: any, // TODO Suspense
): void {
  anchor = anchor === 0 ? parent.$fc || child(parent) : anchor
  if (block instanceof Node) {
    // 仅在元素节点上应用过渡效果
    if (
      block instanceof Element &&
      (block as TransitionBlock).$transition &&
      !(block as TransitionBlock).$transition!.disabled &&
      moveType !== MoveType.REORDER
    ) {
      if (moveType === MoveType.ENTER) {
        performTransitionEnter(
          block,
          (block as TransitionBlock).$transition as TransitionHooks,
          () => parent.insertBefore(block, anchor as Node),
          parentSuspense,
          true,
        )
      } else {
        performTransitionLeave(
          block,
          (block as TransitionBlock).$transition as TransitionHooks,
          () => {
            // 如果组件在离开动画完成后被卸载，移除该块
            // 以避免保留一个已分离的节点
            if (
              moveType === MoveType.LEAVE &&
              parentComponent &&
              parentComponent.isUnmounted
            ) {
              block.remove()
            } else {
              parent.insertBefore(block, anchor as Node)
            }
          },
          parentSuspense,
          true,
        )
      }
    } else {
      parent.insertBefore(block, anchor)
    }
  } else if (isVaporComponent(block)) {
    if (block.isMounted) {
      move(
        block.block!,
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      )
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (const b of block) {
      move(b, parent, anchor, moveType, parentComponent, parentSuspense)
    }
  } else {
    if (block.anchor) {
      move(
        block.anchor,
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      )
      anchor = block.anchor
    }
    // 片段
    if (block.insert) {
      block.insert(parent, anchor, (block as TransitionBlock).$transition)
    } else {
      move(
        block.nodes,
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      )
    }
  }
}

export function prepend(parent: ParentNode, ...blocks: Block[]): void {
  let i = blocks.length
  while (i--) insert(blocks[i], parent, 0)
}

export function remove(block: Block, parent?: ParentNode): void {
  if (block instanceof Node) {
    if ((block as TransitionBlock).$transition && block instanceof Element) {
      performTransitionLeave(
        block,
        (block as TransitionBlock).$transition as TransitionHooks,
        () => parent && parent.removeChild(block),
      )
    } else {
      parent && parent.removeChild(block)
    }
  } else if (isVaporComponent(block)) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      remove(block[i], parent)
    }
  } else {
    // 片段
    if (block.remove) {
      block.remove(parent, (block as TransitionBlock).$transition)
    } else {
      remove(block.nodes, parent)
    }
    if (block.anchor) remove(block.anchor, parent)
    if ((block as DynamicFragment).scope) {
      ;(block as DynamicFragment).scope!.stop()
    }
  }
}

/**
 * 仅用于开发/测试
 */
export function normalizeBlock(block: Block): Node[] {
  if (!__DEV__ && !__TEST__) {
    throw new Error('normalizeBlock 不应在生产代码路径中使用')
  }
  const nodes: Node[] = []
  if (block instanceof Node) {
    nodes.push(block)
  } else if (isArray(block)) {
    block.forEach(child => nodes.push(...normalizeBlock(child)))
  } else if (isVaporComponent(block)) {
    nodes.push(...normalizeBlock(block.block!))
  } else {
    if (isTeleportFragment(block)) {
      nodes.push(block.placeholder!, block.anchor!)
    } else {
      nodes.push(...normalizeBlock(block.nodes))
      block.anchor && nodes.push(block.anchor)
    }
  }
  return nodes
}

export function findBlockNode(block: Block): {
  parentNode: Node | null
  nextNode: Node | null
} {
  let { parentNode, nextSibling: nextNode } = findLastChild(block)!

  // 如果节点作为片段渲染，且当前 nextNode 是片段的结束锚点，
  // 需要移动到下一个节点
  if (nextNode && isComment(nextNode, ']') && isFragmentBlock(block)) {
    nextNode = nextNode.nextSibling
  }

  return {
    parentNode,
    nextNode,
  }
}

function findLastChild(node: Block): Node | undefined | null {
  if (node && node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return findLastChild(node[node.length - 1])
  } else if (isVaporComponent(node)) {
    return findLastChild(node.block!)
  } else {
    if (node.anchor) return node.anchor
    return findLastChild(node.nodes!)
  }
}

export function isFragmentBlock(block: Block): boolean {
  if (isArray(block)) {
    return true
  } else if (isVaporComponent(block)) {
    return isFragmentBlock(block.block!)
  } else if (isFragment(block)) {
    return isFragmentBlock(block.nodes)
  }
  return false
}

export function setScopeId(block: Block, scopeIds: string[]): void {
  if (block instanceof Element) {
    for (const id of scopeIds) {
      block.setAttribute(id, '')
    }
  } else if (isVaporComponent(block)) {
    setScopeId(block.block, scopeIds)
  } else if (isArray(block)) {
    for (const b of block) {
      setScopeId(b, scopeIds)
    }
  } else if (isFragment(block)) {
    setScopeId(block.nodes, scopeIds)
  }
}

export function setComponentScopeId(instance: VaporComponentInstance): void {
  const { parent, scopeId } = instance
  if (!parent || !scopeId) return

  // 防止在多根片段上设置 scopeId
  if (isArray(instance.block) && instance.block.length > 1) return

  const scopeIds: string[] = []
  const parentScopeId = parent && parent.type.__scopeId
  // 如果父级 scopeId 与当前 scopeId 不同，这意味着 scopeId
  // 是从插槽所有者继承的，因此我们需要将其设置到组件的
  // scopeIds 中。`parentScopeId-s` 在 createSlot 中处理
  if (parentScopeId !== scopeId) {
    scopeIds.push(scopeId)
  } else {
    if (parentScopeId) scopeIds.push(parentScopeId)
  }

  // 从 vdom 父级继承 scopeId
  if (
    parent.subTree &&
    (parent.subTree.component as any) === instance &&
    parent.vnode!.scopeId
  ) {
    scopeIds.push(parent.vnode!.scopeId)
    const inheritedScopeIds = getInheritedScopeIds(parent.vnode!, parent.parent)
    scopeIds.push(...inheritedScopeIds)
  }

  if (scopeIds.length > 0) {
    setScopeId(instance.block, scopeIds)
  }
}

// 过渡钩子注册表，用于 tree-shaking
// 这些由 Transition 组件在使用时注册
type ApplyTransitionHooksFn = (
  block: Block,
  hooks: VaporTransitionHooks,
) => VaporTransitionHooks
type ApplyTransitionLeaveHooksFn = (
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
) => void

let _applyTransitionHooks: ApplyTransitionHooksFn | undefined
let _applyTransitionLeaveHooks: ApplyTransitionLeaveHooksFn | undefined

export function registerTransitionHooks(
  applyHooks: ApplyTransitionHooksFn,
  applyLeaveHooks: ApplyTransitionLeaveHooksFn,
): void {
  _applyTransitionHooks = applyHooks
  _applyTransitionLeaveHooks = applyLeaveHooks
}

export function applyTransitionHooks(
  block: Block,
  hooks: VaporTransitionHooks,
): VaporTransitionHooks {
  return _applyTransitionHooks ? _applyTransitionHooks(block, hooks) : hooks
}

export function applyTransitionLeaveHooks(
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
): void {
  _applyTransitionLeaveHooks &&
    _applyTransitionLeaveHooks(block, enterHooks, afterLeaveCb)
}
