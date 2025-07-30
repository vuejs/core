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
import { createComment, createTextNode } from './dom/node'
import {
  type Block,
  VaporFragment,
  insert,
  remove as removeBlock,
} from './block'
import { warn } from '@vue/runtime-dom'
import { currentInstance, isVaporComponent } from './component'
import type { DynamicSlot } from './componentSlots'
import { renderEffect } from './renderEffect'
import { VaporVForFlags } from '../../shared/src/vaporFlags'
import { isHydrating, locateHydrationNode } from './dom/hydration'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'

class ForBlock extends VaporFragment {
  scope: EffectScope | undefined
  key: any

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
): VaporFragment => {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (isHydrating) {
    locateHydrationNode()
  } else {
    resetInsertionState()
  }

  let isMounted = false
  let oldBlocks: ForBlock[] = []
  let newBlocks: ForBlock[]
  let parent: ParentNode | undefined | null
  // useSelector only
  let currentKey: any
  // TODO handle this in hydration
  const parentAnchor = __DEV__ ? createComment('for') : createTextNode()
  const frag = new VaporFragment(oldBlocks)
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

    const prevSub = setActiveSub()

    if (!isMounted) {
      isMounted = true
      for (let i = 0; i < newLength; i++) {
        mount(source, i)
      }
    } else {
      parent = parent || parentAnchor!.parentNode
      if (!oldLength) {
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

        const sharedBlockCount = Math.min(oldLength, newLength)
        const previousKeyIndexPairs: [any, number][] = new Array(oldLength)
        const queuedBlocks: [
          blockIndex: number,
          blockItem: ReturnType<typeof getItem>,
          blockKey: any,
        ][] = new Array(newLength)

        let anchorFallback: Node = parentAnchor
        let endOffset = 0
        let startOffset = 0
        let queuedBlocksInsertIndex = 0
        let previousKeyIndexInsertIndex = 0

        while (endOffset < sharedBlockCount) {
          const currentIndex = newLength - endOffset - 1
          const currentItem = getItem(source, currentIndex)
          const currentKey = getKey(...currentItem)
          const existingBlock = oldBlocks[oldLength - endOffset - 1]
          if (existingBlock.key === currentKey) {
            update(existingBlock, ...currentItem)
            newBlocks[currentIndex] = existingBlock
            endOffset++
            continue
          }
          break
        }

        if (endOffset !== 0) {
          anchorFallback = normalizeAnchor(
            newBlocks[newLength - endOffset].nodes,
          )
        }

        while (startOffset < sharedBlockCount - endOffset) {
          const currentItem = getItem(source, startOffset)
          const currentKey = getKey(...currentItem)
          const previousBlock = oldBlocks[startOffset]
          const previousKey = previousBlock.key
          if (previousKey === currentKey) {
            update((newBlocks[startOffset] = previousBlock), currentItem[0])
          } else {
            queuedBlocks[queuedBlocksInsertIndex++] = [
              startOffset,
              currentItem,
              currentKey,
            ]
            previousKeyIndexPairs[previousKeyIndexInsertIndex++] = [
              previousKey,
              startOffset,
            ]
          }
          startOffset++
        }

        for (let i = startOffset; i < oldLength - endOffset; i++) {
          previousKeyIndexPairs[previousKeyIndexInsertIndex++] = [
            oldBlocks[i].key,
            i,
          ]
        }

        const preparationBlockCount = Math.min(
          newLength - endOffset,
          sharedBlockCount,
        )
        for (let i = startOffset; i < preparationBlockCount; i++) {
          const blockItem = getItem(source, i)
          const blockKey = getKey(...blockItem)
          queuedBlocks[queuedBlocksInsertIndex++] = [i, blockItem, blockKey]
        }

        if (!queuedBlocksInsertIndex && !previousKeyIndexInsertIndex) {
          for (let i = preparationBlockCount; i < newLength - endOffset; i++) {
            const blockItem = getItem(source, i)
            const blockKey = getKey(...blockItem)
            mount(source, i, anchorFallback, blockItem, blockKey)
          }
        } else {
          queuedBlocks.length = queuedBlocksInsertIndex
          previousKeyIndexPairs.length = previousKeyIndexInsertIndex

          const previousKeyIndexMap = new Map(previousKeyIndexPairs)
          const operations: (() => void)[] = []

          let mountCounter = 0
          const relocateOrMountBlock = (
            blockIndex: number,
            blockItem: ReturnType<typeof getItem>,
            blockKey: any,
            anchorOffset: number,
          ) => {
            const previousIndex = previousKeyIndexMap.get(blockKey)
            if (previousIndex !== undefined) {
              const reusedBlock = (newBlocks[blockIndex] =
                oldBlocks[previousIndex])
              update(reusedBlock, ...blockItem)
              previousKeyIndexMap.delete(blockKey)
              if (previousIndex !== blockIndex) {
                operations.push(() =>
                  insert(
                    reusedBlock,
                    parent!,
                    anchorOffset === -1
                      ? anchorFallback
                      : normalizeAnchor(newBlocks[anchorOffset].nodes),
                  ),
                )
              }
            } else {
              mountCounter++
              operations.push(() =>
                mount(
                  source,
                  blockIndex,
                  anchorOffset === -1
                    ? anchorFallback
                    : normalizeAnchor(newBlocks[anchorOffset].nodes),
                  blockItem,
                  blockKey,
                ),
              )
            }
          }

          for (let i = queuedBlocks.length - 1; i >= 0; i--) {
            const [blockIndex, blockItem, blockKey] = queuedBlocks[i]
            relocateOrMountBlock(
              blockIndex,
              blockItem,
              blockKey,
              blockIndex < preparationBlockCount - 1 ? blockIndex + 1 : -1,
            )
          }

          for (let i = preparationBlockCount; i < newLength - endOffset; i++) {
            const blockItem = getItem(source, i)
            const blockKey = getKey(...blockItem)
            relocateOrMountBlock(i, blockItem, blockKey, -1)
          }

          const useFastRemove = mountCounter === newLength

          for (const leftoverIndex of previousKeyIndexMap.values()) {
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

          // perform mount and move operations
          for (const action of operations) {
            action()
          }
        }
      }
    }

    frag.nodes = [(oldBlocks = newBlocks)]
    if (parentAnchor) {
      frag.nodes.push(parentAnchor)
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
      removeBlock(block.nodes, parent!)
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

  if (!isHydrating && _insertionParent) {
    insert(frag, _insertionParent, _insertionAnchor)
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
