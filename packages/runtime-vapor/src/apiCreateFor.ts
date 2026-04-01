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
import { getSequence, isArray, isObject, isString } from '@vue/shared'
import { createComment, createTextNode } from './dom/node'
import { type Block, insert, remove } from './block'
import { queuePostFlushCb, warn } from '@vue/runtime-dom'
import { currentInstance, isVaporComponent } from './component'
import {
  type DynamicSlot,
  currentSlotOwner,
  setCurrentSlotOwner,
} from './componentSlots'
import { renderEffect } from './renderEffect'
import { VaporVForFlags } from '@vue/shared'
import {
  advanceHydrationNode,
  currentHydrationNode,
  isComment,
  isHydrating,
  locateHydrationNode,
  locateNextNode,
  setCurrentHydrationNode,
} from './dom/hydration'
import { ForFragment, VaporFragment } from './fragment'
import {
  type ChildItem,
  insertionAnchor,
  insertionIndex,
  insertionParent,
  isLastInsertion,
  resetInsertionState,
} from './insertionState'
import { applyTransitionHooks } from './transition'

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
): ForFragment => {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _insertionIndex = insertionIndex
  const _isLastInsertion = isLastInsertion
  if (isHydrating) {
    locateHydrationNode(true)
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

  const slotOwner = currentSlotOwner

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
      let nextNode
      for (let i = 0; i < newLength; i++) {
        if (isHydrating) nextNode = locateNextNode(currentHydrationNode!)
        mount(source, i)
        if (isHydrating && nextNode) setCurrentHydrationNode(nextNode)
      }

      if (isHydrating) {
        parentAnchor = currentHydrationNode!
        if (
          __DEV__ &&
          (!parentAnchor || (parentAnchor && !isComment(parentAnchor, ']')))
        ) {
          throw new Error(
            `v-for fragment anchor node was not found. this is likely a Vue internal bug.`,
          )
        }

        // optimization: cache the fragment end anchor as $llc (last logical child)
        // so that locateChildByLogicalIndex can skip the entire fragment
        if (_insertionParent && isComment(parentAnchor, ']')) {
          ;(parentAnchor as any as ChildItem).$idx = _insertionIndex || 0
          _insertionParent.$llc = parentAnchor
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

        let i = 0
        let e1 = oldLength - 1
        let e2 = newLength - 1

        while (i <= e1 && i <= e2) {
          const oldBlock = oldBlocks[i]
          const item = getItem(source, i)
          if (oldBlock.key !== getKey(...item)) break
          update((newBlocks[i] = oldBlock), ...item)
          i++
        }

        while (i <= e1 && i <= e2) {
          const oldBlock = oldBlocks[e1]
          const item = getItem(source, e2)
          if (oldBlock.key !== getKey(...item)) break
          update((newBlocks[e2] = oldBlock), ...item)
          e1--
          e2--
        }

        if (i > e1) {
          for (let j = e2; j >= i; j--) {
            const nextIndex = j + 1
            mount(
              source,
              j,
              nextIndex < newLength
                ? normalizeAnchor(newBlocks[nextIndex].nodes)
                : parentAnchor,
            )
          }
        } else if (i <= e2) {
          const s1 = i
          const s2 = i
          const toBePatched = e2 - s2 + 1
          const keyToNewIndexMap = new Map<any, number>()
          const newItems = new Array<ReturnType<typeof getItem>>(toBePatched)
          const newKeys = new Array<any>(toBePatched)
          const nullKeyNewIndices: number[] = []

          for (i = s2; i <= e2; i++) {
            const item = getItem(source, i)
            const key = getKey(...item)
            const index = i - s2
            newItems[index] = item
            newKeys[index] = key
            if (key != null) {
              keyToNewIndexMap.set(key, i)
            } else {
              nullKeyNewIndices.push(i)
            }
          }

          const newIndexToOldIndexMap = new Array(toBePatched).fill(0)
          const unmountIndices: number[] = []

          let moved = false
          let maxNewIndexSoFar = 0
          let patched = 0
          let nullKeyCursor = 0

          for (i = s1; i <= e1; i++) {
            const oldBlock = oldBlocks[i]
            if (patched >= toBePatched) {
              unmountIndices.push(i)
              continue
            }
            let newIndex: number | undefined
            if (oldBlock.key != null) {
              newIndex = keyToNewIndexMap.get(oldBlock.key)
            } else {
              while (nullKeyCursor < nullKeyNewIndices.length) {
                const j = nullKeyNewIndices[nullKeyCursor++]
                const index = j - s2
                if (newIndexToOldIndexMap[index] === 0) {
                  newIndex = j
                  break
                }
              }
            }
            if (newIndex === undefined) {
              unmountIndices.push(i)
            } else {
              newIndexToOldIndexMap[newIndex - s2] = i + 1
              if (newIndex >= maxNewIndexSoFar) {
                maxNewIndexSoFar = newIndex
              } else {
                moved = true
              }
              const item = newItems[newIndex - s2]
              update(oldBlock, ...item)
              newBlocks[newIndex] = oldBlock
              patched++
            }
          }

          const mountCounter = toBePatched - patched
          const useFastRemove = mountCounter === newLength

          for (const index of unmountIndices) {
            unmount(
              oldBlocks[index],
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

          const increasingNewIndexSequence = moved
            ? getSequence(newIndexToOldIndexMap)
            : []
          let seqIdx = increasingNewIndexSequence.length - 1

          if (mountCounter > 0 || moved) {
            for (i = toBePatched - 1; i >= 0; i--) {
              const newIndex = s2 + i
              const nextIndex = newIndex + 1
              const anchor =
                nextIndex < newLength
                  ? normalizeAnchor(newBlocks[nextIndex].nodes)
                  : parentAnchor
              if (newIndexToOldIndexMap[i] === 0) {
                mount(source, newIndex, anchor, newItems[i], newKeys[i])
              } else if (moved) {
                if (seqIdx < 0 || i !== increasingNewIndexSequence[seqIdx]) {
                  insert(newBlocks[newIndex], parent!, anchor)
                } else {
                  seqIdx--
                }
              }
            }
          }
        } else {
          while (i <= e1) {
            unmount(oldBlocks[i])
            i++
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

    if (isMounted && frag.onUpdated) frag.onUpdated.forEach(m => m())
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
      applyTransitionHooks(block.nodes, frag.$transition)
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
    renderEffect(() => {
      if (!isMounted) return renderList()
      const prevOwner = setCurrentSlotOwner(slotOwner)
      try {
        renderList()
      } finally {
        setCurrentSlotOwner(prevOwner)
      }
    })
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

      // watch may trigger before list patched
      // defer to post-flush so operMap is up to date
      queuePostFlushCb(() => {
        activeKey = newValue
        activeOpers = operMap.get(newValue)
        if (activeOpers !== undefined) {
          for (const oper of activeOpers) {
            oper()
          }
        }
      })
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
  } else {
    values = []
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
