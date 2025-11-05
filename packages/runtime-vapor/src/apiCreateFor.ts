import {
  EffectScope,
  type ShallowRef,
  isReactive,
  isReadonly,
  isShallow,
  setActiveSub,
  shallowReadArray,
  shallowRef,
  toReactive,
  toReadonly,
  watch,
} from '@vue/reactivity'
import { isArray, isObject, isString } from '@vue/shared'
import {
  createComment,
  createTextNode,
  updateLastLogicalChild,
} from './dom/node'
import { type Block, findBlockNode, insert, remove } from './block'
import { warn } from '@vue/runtime-dom'
import { currentInstance, isVaporComponent } from './component'
import type { DynamicSlot } from './componentSlots'
import { renderEffect } from './renderEffect'
import { VaporVForFlags } from '../../shared/src/vaporFlags'
import {
  advanceHydrationNode,
  currentHydrationNode,
  isComment,
  isHydrating,
  locateHydrationNode,
  setCurrentHydrationNode,
} from './dom/hydration'
import { applyTransitionHooks } from './components/Transition'
import { ForFragment, VaporFragment } from './fragment'
import {
  insertionAnchor,
  insertionParent,
  isLastInsertion,
  resetInsertionState,
} from './insertionState'

class ForBlock extends VaporFragment {
  scope: EffectScope | undefined
  key: any
  prev?: ForBlock
  next?: ForBlock
  prevAnchor?: ForBlock

  itemRef: ShallowRef<any>
  keyRef: ShallowRef<any> | undefined
  indexRef: ShallowRef<number | undefined> | undefined

  constructor(
    nodes: Block,
    scope: EffectScope | undefined,
    item: ShallowRef<any>,
    key: ShallowRef<any> | undefined,
    index: ShallowRef<number | undefined> | undefined,
    renderKey: any,
  ) {
    super(nodes)
    this.scope = scope
    this.itemRef = item
    this.keyRef = key
    this.indexRef = index
    this.key = renderKey
  }
}

type Source = any[] | Record<any, any> | number | Set<any> | Map<any, any>

type ResolvedSource = {
  values: any[]
  needsWrap: boolean
  isReadonlySource: boolean
  keys?: string[]
}

export const createFor = (
  src: () => Source,
  renderItem: (
    item: ShallowRef<any>,
    key: ShallowRef<any>,
    index: ShallowRef<number | undefined>,
  ) => Block,
  getKey?: (item: any, key: any, index?: number) => any,
  flags = 0,
  setup?: (_: {
    createSelector: (source: () => any) => (cb: () => void) => void
  }) => void,
): ForFragment => {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _isLastInsertion = isLastInsertion
  if (isHydrating) {
    locateHydrationNode()
  } else {
    resetInsertionState()
  }

  let isMounted = false
  let oldBlocks: ForBlock[] = []
  let newBlocks: ForBlock[]
  let parent: ParentNode | undefined | null
  // createSelector only
  let currentKey: any
  let parentAnchor: Node
  if (!isHydrating) {
    parentAnchor = __DEV__ ? createComment('for') : createTextNode()
  }

  const frag = new ForFragment(oldBlocks)
  const instance = currentInstance!
  const canUseFastRemove = !!(flags & VaporVForFlags.FAST_REMOVE)
  const isComponent = !!(flags & VaporVForFlags.IS_COMPONENT)
  const selectors: {
    deregister: (key: any) => void
    cleanup: () => void
  }[] = []

  if (__DEV__ && !instance) {
    warn('createFor() can only be used inside setup()')
  }

  const renderList = () => {
    const source = normalizeSource(src())
    const newLength = source.values.length
    const oldLength = oldBlocks.length
    newBlocks = new Array(newLength)
    let isFallback = false

    const prevSub = setActiveSub()

    if (!isMounted) {
      isMounted = true
      for (let i = 0; i < newLength; i++) {
        const nodes = mount(source, i).nodes
        if (isHydrating) {
          setCurrentHydrationNode(findBlockNode(nodes!).nextNode)
        }
      }

      if (isHydrating) {
        parentAnchor =
          newLength === 0
            ? currentHydrationNode!.nextSibling!
            : currentHydrationNode!
        if (
          __DEV__ &&
          (!parentAnchor || (parentAnchor && !isComment(parentAnchor, ']')))
        ) {
          throw new Error(
            `v-for fragment anchor node was not found. this is likely a Vue internal bug.`,
          )
        }

        if (_insertionParent) {
          updateLastLogicalChild(_insertionParent!, parentAnchor)
        }
      }
    } else {
      parent = parent || parentAnchor!.parentNode
      if (!oldLength) {
        // remove fallback nodes
        if (frag.fallback && (frag.nodes[0] as Block[]).length > 0) {
          remove(frag.nodes[0], parent!)
        }

        // fast path for all new
        for (let i = 0; i < newLength; i++) {
          mount(source, i)
        }
      } else if (!newLength) {
        // fast path for clearing all
        for (const selector of selectors) {
          selector.cleanup()
        }
        const doRemove = !canUseFastRemove
        for (let i = 0; i < oldLength; i++) {
          unmount(oldBlocks[i], doRemove, false)
        }
        if (canUseFastRemove) {
          parent!.textContent = ''
          parent!.appendChild(parentAnchor)
        }

        // render fallback nodes
        if (frag.fallback) {
          insert((frag.nodes[0] = frag.fallback()), parent!, parentAnchor)
          isFallback = true
        }
      } else if (!getKey) {
        // unkeyed fast path
        const commonLength = Math.min(newLength, oldLength)
        for (let i = 0; i < commonLength; i++) {
          update((newBlocks[i] = oldBlocks[i]), getItem(source, i)[0])
        }
        for (let i = oldLength; i < newLength; i++) {
          mount(source, i)
        }
        for (let i = newLength; i < oldLength; i++) {
          unmount(oldBlocks[i])
        }
      } else {
        if (__DEV__) {
          const keyToIndexMap: Map<any, number> = new Map()
          for (let i = 0; i < newLength; i++) {
            const item = getItem(source, i)
            const key = getKey(...item)
            if (key != null) {
              if (keyToIndexMap.has(key)) {
                warn(
                  `Duplicate keys found during update:`,
                  JSON.stringify(key),
                  `Make sure keys are unique.`,
                )
              }
              keyToIndexMap.set(key, i)
            }
          }
        }

        const commonLength = Math.min(oldLength, newLength)
        const oldKeyIndexPairs: [any, number][] = new Array(oldLength)
        const queuedBlocks: [
          index: number,
          item: ReturnType<typeof getItem>,
          key: any,
        ][] = new Array(newLength)

        let endOffset = 0
        let queuedBlocksLength = 0
        let oldKeyIndexPairsLength = 0

        while (endOffset < commonLength) {
          const index = newLength - endOffset - 1
          const item = getItem(source, index)
          const key = getKey(...item)
          const existingBlock = oldBlocks[oldLength - endOffset - 1]
          if (existingBlock.key !== key) break
          update(existingBlock, ...item)
          newBlocks[index] = existingBlock
          endOffset++
        }

        const e1 = commonLength - endOffset
        const e2 = oldLength - endOffset
        const e3 = newLength - endOffset

        for (let i = 0; i < e1; i++) {
          const currentItem = getItem(source, i)
          const currentKey = getKey(...currentItem)
          const oldBlock = oldBlocks[i]
          const oldKey = oldBlock.key
          if (oldKey === currentKey) {
            update((newBlocks[i] = oldBlock), currentItem[0])
          } else {
            queuedBlocks[queuedBlocksLength++] = [i, currentItem, currentKey]
            oldKeyIndexPairs[oldKeyIndexPairsLength++] = [oldKey, i]
          }
        }

        for (let i = e1; i < e2; i++) {
          oldKeyIndexPairs[oldKeyIndexPairsLength++] = [oldBlocks[i].key, i]
        }

        for (let i = e1; i < e3; i++) {
          const blockItem = getItem(source, i)
          const blockKey = getKey(...blockItem)
          queuedBlocks[queuedBlocksLength++] = [i, blockItem, blockKey]
        }

        queuedBlocks.length = queuedBlocksLength
        oldKeyIndexPairs.length = oldKeyIndexPairsLength

        interface MountOper {
          source: ResolvedSource
          index: number
          item: ReturnType<typeof getItem>
          key: any
        }
        interface MoveOper {
          index: number
          block: ForBlock
        }

        const oldKeyIndexMap = new Map(oldKeyIndexPairs)
        const opers: (MountOper | MoveOper)[] = new Array(queuedBlocks.length)

        let mountCounter = 0
        let opersLength = 0

        for (let i = queuedBlocks.length - 1; i >= 0; i--) {
          const [index, item, key] = queuedBlocks[i]
          const oldIndex = oldKeyIndexMap.get(key)
          if (oldIndex !== undefined) {
            oldKeyIndexMap.delete(key)
            const reusedBlock = (newBlocks[index] = oldBlocks[oldIndex])
            update(reusedBlock, ...item)
            opers[opersLength++] = { index, block: reusedBlock }
          } else {
            mountCounter++
            opers[opersLength++] = { source, index, item, key }
          }
        }

        const useFastRemove = mountCounter === newLength

        for (const leftoverIndex of oldKeyIndexMap.values()) {
          unmount(
            oldBlocks[leftoverIndex],
            !(useFastRemove && canUseFastRemove),
            !useFastRemove,
          )
        }
        if (useFastRemove) {
          for (const selector of selectors) {
            selector.cleanup()
          }
          if (canUseFastRemove) {
            parent!.textContent = ''
            parent!.appendChild(parentAnchor)
          }
        }

        if (opers.length === mountCounter) {
          for (const { source, index, item, key } of opers as MountOper[]) {
            mount(
              source,
              index,
              index < newLength - 1
                ? normalizeAnchor(newBlocks[index + 1].nodes)
                : parentAnchor,
              item,
              key,
            )
          }
        } else if (opers.length) {
          let anchor = oldBlocks[0]
          let blocksTail: ForBlock | undefined
          for (let i = 0; i < oldLength; i++) {
            const block = oldBlocks[i]
            if (oldKeyIndexMap.has(block.key)) {
              continue
            }
            block.prevAnchor = anchor
            anchor = oldBlocks[i + 1]
            if (blocksTail !== undefined) {
              blocksTail.next = block
              block.prev = blocksTail
            }
            blocksTail = block
          }
          for (const action of opers) {
            const { index } = action
            if (index < newLength - 1) {
              const nextBlock = newBlocks[index + 1]
              let anchorNode = normalizeAnchor(nextBlock.prevAnchor!.nodes)
              if (!anchorNode.parentNode)
                anchorNode = normalizeAnchor(nextBlock.nodes)
              if ('source' in action) {
                const { item, key } = action
                const block = mount(source, index, anchorNode, item, key)
                moveLink(block, nextBlock.prev, nextBlock)
              } else if (action.block.next !== nextBlock) {
                insert(action.block, parent!, anchorNode)
                moveLink(action.block, nextBlock.prev, nextBlock)
              }
            } else if ('source' in action) {
              const { item, key } = action
              const block = mount(source, index, parentAnchor, item, key)
              moveLink(block, blocksTail)
              blocksTail = block
            } else if (action.block.next !== undefined) {
              let anchorNode = anchor
                ? normalizeAnchor(anchor.nodes)
                : parentAnchor
              if (!anchorNode.parentNode) anchorNode = parentAnchor
              insert(action.block, parent!, anchorNode)
              moveLink(action.block, blocksTail)
              blocksTail = action.block
            }
          }
          for (const block of newBlocks) {
            block.prevAnchor = block.next = block.prev = undefined
          }
        }
      }
    }

    if (!isFallback) {
      frag.nodes = [(oldBlocks = newBlocks)]
      if (parentAnchor) frag.nodes.push(parentAnchor)
    } else {
      oldBlocks = []
    }
    setActiveSub(prevSub)
  }

  const needKey = renderItem.length > 1
  const needIndex = renderItem.length > 2

  const mount = (
    source: ResolvedSource,
    idx: number,
    anchor: Node | undefined = parentAnchor,
    [item, key, index] = getItem(source, idx),
    key2 = getKey && getKey(item, key, index),
  ): ForBlock => {
    const itemRef = shallowRef(item)
    // avoid creating refs if the render fn doesn't need it
    const keyRef = needKey ? shallowRef(key) : undefined
    const indexRef = needIndex ? shallowRef(index) : undefined

    currentKey = key2
    let nodes: Block
    let scope: EffectScope | undefined
    if (isComponent) {
      // component already has its own scope so no outer scope needed
      nodes = renderItem(itemRef, keyRef as any, indexRef as any)
    } else {
      scope = new EffectScope()
      nodes = scope.run(() =>
        renderItem(itemRef, keyRef as any, indexRef as any),
      )!
    }

    const block = (newBlocks[idx] = new ForBlock(
      nodes,
      scope,
      itemRef,
      keyRef,
      indexRef,
      key2,
    ))

    // apply transition for new nodes
    if (frag.$transition) {
      applyTransitionHooks(block.nodes, frag.$transition, false)
    }

    if (parent) insert(block.nodes, parent, anchor)

    return block
  }

  const update = (
    { itemRef, keyRef, indexRef }: ForBlock,
    newItem: any,
    newKey?: any,
    newIndex?: any,
  ) => {
    if (newItem !== itemRef.value) {
      itemRef.value = newItem
    }
    if (keyRef && newKey !== undefined && newKey !== keyRef.value) {
      keyRef.value = newKey
    }
    if (indexRef && newIndex !== undefined && newIndex !== indexRef.value) {
      indexRef.value = newIndex
    }
  }

  const unmount = (block: ForBlock, doRemove = true, doDeregister = true) => {
    if (!isComponent) {
      block.scope!.stop()
    }
    if (doRemove) {
      remove(block.nodes, parent!)
    }
    if (doDeregister) {
      for (const selector of selectors) {
        selector.deregister(block.key)
      }
    }
  }

  if (setup) {
    setup({ createSelector })
  }

  if (flags & VaporVForFlags.ONCE) {
    renderList()
  } else {
    renderEffect(renderList)
  }

  if (!isHydrating) {
    if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  } else {
    advanceHydrationNode(_isLastInsertion ? _insertionParent! : parentAnchor!)
  }

  return frag

  function createSelector(source: () => any): (cb: () => void) => void {
    let operMap = new Map<any, (() => void)[]>()
    let activeKey = source()
    let activeOpers: (() => void)[] | undefined

    watch(source, newValue => {
      if (activeOpers !== undefined) {
        for (const oper of activeOpers) {
          oper()
        }
      }
      activeOpers = operMap.get(newValue)
      if (activeOpers !== undefined) {
        for (const oper of activeOpers) {
          oper()
        }
      }
    })

    selectors.push({ deregister, cleanup })
    return register

    function cleanup() {
      operMap = new Map()
      activeOpers = undefined
    }

    function register(oper: () => void) {
      oper()
      let opers = operMap.get(currentKey)
      if (opers !== undefined) {
        opers.push(oper)
      } else {
        opers = [oper]
        operMap.set(currentKey, opers)
        if (currentKey === activeKey) {
          activeOpers = opers
        }
      }
    }

    function deregister(key: any) {
      operMap.delete(key)
      if (key === activeKey) {
        activeOpers = undefined
      }
    }
  }
}

function moveLink(block: ForBlock, newPrev?: ForBlock, newNext?: ForBlock) {
  const { prev: oldPrev, next: oldNext } = block
  if (oldPrev) oldPrev.next = oldNext
  if (oldNext) {
    oldNext.prev = oldPrev
    if (block.prevAnchor !== block) {
      oldNext.prevAnchor = block.prevAnchor
    }
  }
  if (newPrev) newPrev.next = block
  if (newNext) newNext.prev = block
  block.prev = newPrev
  block.next = newNext
  block.prevAnchor = block
}

export function createForSlots(
  rawSource: Source,
  getSlot: (item: any, key: any, index?: number) => DynamicSlot,
): DynamicSlot[] {
  const source = normalizeSource(rawSource)
  const sourceLength = source.values.length
  const slots = new Array<DynamicSlot>(sourceLength)
  for (let i = 0; i < sourceLength; i++) {
    slots[i] = getSlot(...getItem(source, i))
  }
  return slots
}

function normalizeSource(source: any): ResolvedSource {
  let values = source
  let needsWrap = false
  let isReadonlySource = false
  let keys
  if (isArray(source)) {
    if (isReactive(source)) {
      needsWrap = !isShallow(source)
      values = shallowReadArray(source)
      isReadonlySource = isReadonly(source)
    }
  } else if (isString(source)) {
    values = source.split('')
  } else if (typeof source === 'number') {
    if (__DEV__ && !Number.isInteger(source)) {
      warn(`The v-for range expect an integer value but got ${source}.`)
    }
    values = new Array(source)
    for (let i = 0; i < source; i++) values[i] = i + 1
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      values = Array.from(source as Iterable<any>)
    } else {
      keys = Object.keys(source)
      values = new Array(keys.length)
      for (let i = 0, l = keys.length; i < l; i++) {
        values[i] = source[keys[i]]
      }
    }
  }
  return {
    values,
    needsWrap,
    isReadonlySource,
    keys,
  }
}

function getItem(
  { keys, values, needsWrap, isReadonlySource }: ResolvedSource,
  idx: number,
): [item: any, key: any, index?: number] {
  const value = needsWrap
    ? isReadonlySource
      ? toReadonly(toReactive(values[idx]))
      : toReactive(values[idx])
    : values[idx]
  if (keys) {
    return [value, keys[idx], idx]
  } else {
    return [value, idx, undefined]
  }
}

function normalizeAnchor(node: Block): Node {
  if (node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return normalizeAnchor(node[0])
  } else if (isVaporComponent(node)) {
    return normalizeAnchor(node.block!)
  } else {
    return normalizeAnchor(node.nodes!)
  }
}

// runtime helper for rest element destructure
export function getRestElement(val: any, keys: string[]): any {
  const res: any = {}
  for (const key in val) {
    if (!keys.includes(key)) res[key] = val[key]
  }
  return res
}

export function getDefaultValue(val: any, defaultVal: any): any {
  return val === undefined ? defaultVal : val
}

export function isForBlock(block: Block): block is ForBlock {
  return block instanceof ForBlock
}
