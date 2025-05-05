import {
  EffectScope,
  type ShallowRef,
  isReactive,
  isShallow,
  pauseTracking,
  resetTracking,
  shallowReadArray,
  shallowRef,
  toReactive,
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
import { insertionAnchor, insertionParent } from './insertionState'

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
): VaporFragment => {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (isHydrating) {
    locateHydrationNode()
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

    pauseTracking()

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
        const commonLength = Math.min(oldLength, newLength)
        const oldKeyToIndex: [any, number][] = new Array(oldLength)
        const pendingNews: [
          index: number,
          item: ReturnType<typeof getItem>,
          key: any,
        ][] = new Array(newLength)

        let defaultAnchor: Node = parentAnchor
        let right = 0
        let left = 0
        let l1 = 0
        let l2 = 0

        while (right < commonLength) {
          const index = newLength - right - 1
          const item = getItem(source, index)
          const key = getKey(...item)
          const block = oldBlocks[oldLength - right - 1]
          if (block.key === key) {
            update(block, ...item)
            newBlocks[index] = block
            right++
            continue
          }
          if (right !== 0) {
            defaultAnchor = normalizeAnchor(newBlocks[index + 1].nodes)
          }
          break
        }

        while (left < commonLength - right) {
          const item = getItem(source, left)
          const key = getKey(...item)
          const oldBlock = oldBlocks[left]
          const oldKey = oldBlock.key
          if (oldKey === key) {
            update((newBlocks[left] = oldBlock), item[0])
          } else {
            pendingNews[l1++] = [left, item, key]
            oldKeyToIndex[l2++] = [oldKey, left]
          }
          left++
        }

        for (let i = left; i < oldLength - right; i++) {
          oldKeyToIndex[l2++] = [oldBlocks[i].key, i]
        }

        const prepareLength = Math.min(newLength - right, commonLength)
        for (let i = left; i < prepareLength; i++) {
          const item = getItem(source, i)
          const key = getKey(...item)
          pendingNews[l1++] = [i, item, key]
        }

        if (!l1 && !l2) {
          for (let i = prepareLength; i < newLength - right; i++) {
            const item = getItem(source, i)
            const key = getKey(...item)
            mount(source, i, item, key, defaultAnchor)
          }
        } else {
          pendingNews.length = l1
          oldKeyToIndex.length = l2

          const oldKeyToIndexMap = new Map(oldKeyToIndex)
          const pendingMounts: [
            index: number,
            item: ReturnType<typeof getItem>,
            key: any,
            anchorIndex: number,
          ][] = []
          const moveOrMount = (
            index: number,
            item: ReturnType<typeof getItem>,
            key: any,
            anchorIndex: number,
          ) => {
            const oldIndex = oldKeyToIndexMap.get(key)
            if (oldIndex !== undefined) {
              const block = (newBlocks[index] = oldBlocks[oldIndex])
              update(block, ...item)
              insert(
                block,
                parent!,
                anchorIndex === -1
                  ? defaultAnchor
                  : normalizeAnchor(newBlocks[anchorIndex].nodes),
              )
              oldKeyToIndexMap.delete(key)
            } else {
              pendingMounts.push([index, item, key, anchorIndex])
            }
          }

          for (let i = pendingNews.length - 1; i >= 0; i--) {
            const [index, item, key] = pendingNews[i]
            moveOrMount(
              index,
              item,
              key,
              index < prepareLength - 1 ? index + 1 : -1,
            )
          }

          for (let i = prepareLength; i < newLength - right; i++) {
            const item = getItem(source, i)
            const key = getKey(...item)
            moveOrMount(i, item, key, -1)
          }

          const shouldUseFastRemove = pendingMounts.length === newLength

          for (const i of oldKeyToIndexMap.values()) {
            unmount(
              oldBlocks[i],
              !(shouldUseFastRemove && canUseFastRemove),
              !shouldUseFastRemove,
            )
          }
          if (shouldUseFastRemove) {
            for (const selector of selectors) {
              selector.cleanup()
            }
            if (canUseFastRemove) {
              parent!.textContent = ''
              parent!.appendChild(parentAnchor)
            }
          }

          for (const [index, item, key, anchorIndex] of pendingMounts) {
            mount(
              source,
              index,
              item,
              key,
              anchorIndex === -1
                ? defaultAnchor
                : normalizeAnchor(newBlocks[anchorIndex].nodes),
            )
          }
        }
      }
    }

    frag.nodes = [(oldBlocks = newBlocks)]
    if (parentAnchor) {
      frag.nodes.push(parentAnchor)
    }

    resetTracking()
  }

  const needKey = renderItem.length > 1
  const needIndex = renderItem.length > 2

  const mount = (
    source: ResolvedSource,
    idx: number,
    [item, key, index] = getItem(source, idx),
    key2 = getKey && getKey(item, key, index),
    anchor: Node | undefined = parentAnchor,
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

  if (flags & VaporVForFlags.ONCE) {
    renderList()
  } else {
    renderEffect(renderList)
  }

  if (!isHydrating && _insertionParent) {
    insert(frag, _insertionParent, _insertionAnchor)
  }

  // @ts-expect-error
  frag.useSelector = useSelector

  return frag

  function useSelector(
    getActiveKey: () => any,
  ): (key: any, cb: () => void) => void {
    let operMap = new Map<any, (() => void)[]>()
    let activeKey = getActiveKey()
    let activeOpers: (() => void)[] | undefined

    watch(getActiveKey, newValue => {
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
  let keys
  if (isArray(source)) {
    if (isReactive(source)) {
      needsWrap = !isShallow(source)
      values = shallowReadArray(source)
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
  return { values, needsWrap, keys }
}

function getItem(
  { keys, values, needsWrap }: ResolvedSource,
  idx: number,
): [item: any, key: any, index?: number] {
  const value = needsWrap ? toReactive(values[idx]) : values[idx]
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
