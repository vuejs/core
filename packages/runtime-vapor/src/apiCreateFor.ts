import {
  EffectScope,
  type ShallowRef,
  isReactive,
  isReadonly,
  isShallow,
  pauseTracking,
  resetTracking,
  shallowReadArray,
  shallowRef,
  toReactive,
  toReadonly,
} from '@vue/reactivity'
import {
  FOR_ANCHOR_LABEL,
  getSequence,
  isArray,
  isObject,
  isString,
} from '@vue/shared'
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
import {
  currentHydrationNode,
  isHydrating,
  locateHydrationNode,
  locateVaporFragmentAnchor,
} from './dom/hydration'
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
): VaporFragment => {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (isHydrating) {
    locateHydrationNode(true)
  } else {
    resetInsertionState()
  }

  let isMounted = false
  let oldBlocks: ForBlock[] = []
  let newBlocks: ForBlock[]
  let parent: ParentNode | undefined | null
  let parentAnchor: Node
  if (isHydrating) {
    parentAnchor = locateVaporFragmentAnchor(
      currentHydrationNode!,
      FOR_ANCHOR_LABEL,
    )!
    if (__DEV__ && !parentAnchor) {
      // this should not happen
      throw new Error(`v-for fragment anchor node was not found.`)
    }
  } else {
    parentAnchor = __DEV__ ? createComment('for') : createTextNode()
  }

  const frag = new VaporFragment(oldBlocks)
  const instance = currentInstance!
  const canUseFastRemove = flags & VaporVForFlags.FAST_REMOVE
  const isComponent = flags & VaporVForFlags.IS_COMPONENT

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
        const doRemove = !canUseFastRemove
        for (let i = 0; i < oldLength; i++) {
          unmount(oldBlocks[i], doRemove)
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
        let i = 0
        let e1 = oldLength - 1 // prev ending index
        let e2 = newLength - 1 // next ending index

        // 1. sync from start
        // (a b) c
        // (a b) d e
        while (i <= e1 && i <= e2) {
          if (tryPatchIndex(source, i)) {
            i++
          } else {
            break
          }
        }

        // 2. sync from end
        // a (b c)
        // d e (b c)
        while (i <= e1 && i <= e2) {
          if (tryPatchIndex(source, i)) {
            e1--
            e2--
          } else {
            break
          }
        }

        // 3. common sequence + mount
        // (a b)
        // (a b) c
        // i = 2, e1 = 1, e2 = 2
        // (a b)
        // c (a b)
        // i = 0, e1 = -1, e2 = 0
        if (i > e1) {
          if (i <= e2) {
            const nextPos = e2 + 1
            const anchor =
              nextPos < newLength
                ? normalizeAnchor(newBlocks[nextPos].nodes)
                : parentAnchor
            while (i <= e2) {
              mount(source, i, anchor)
              i++
            }
          }
        }

        // 4. common sequence + unmount
        // (a b) c
        // (a b)
        // i = 2, e1 = 2, e2 = 1
        // a (b c)
        // (b c)
        // i = 0, e1 = 0, e2 = -1
        else if (i > e2) {
          while (i <= e1) {
            unmount(oldBlocks[i])
            i++
          }
        }

        // 5. unknown sequence
        // [i ... e1 + 1]: a b [c d e] f g
        // [i ... e2 + 1]: a b [e d c h] f g
        // i = 2, e1 = 4, e2 = 5
        else {
          const s1 = i // prev starting index
          const s2 = i // next starting index

          // 5.1 build key:index map for newChildren
          const keyToNewIndexMap = new Map()
          for (i = s2; i <= e2; i++) {
            keyToNewIndexMap.set(getKey(...getItem(source, i)), i)
          }

          // 5.2 loop through old children left to be patched and try to patch
          // matching nodes & remove nodes that are no longer present
          let j
          let patched = 0
          const toBePatched = e2 - s2 + 1
          let moved = false
          // used to track whether any node has moved
          let maxNewIndexSoFar = 0
          // works as Map<newIndex, oldIndex>
          // Note that oldIndex is offset by +1
          // and oldIndex = 0 is a special value indicating the new node has
          // no corresponding old node.
          // used for determining longest stable subsequence
          const newIndexToOldIndexMap = new Array(toBePatched).fill(0)

          for (i = s1; i <= e1; i++) {
            const prevBlock = oldBlocks[i]
            if (patched >= toBePatched) {
              // all new children have been patched so this can only be a removal
              unmount(prevBlock)
            } else {
              const newIndex = keyToNewIndexMap.get(prevBlock.key)
              if (newIndex == null) {
                unmount(prevBlock)
              } else {
                newIndexToOldIndexMap[newIndex - s2] = i + 1
                if (newIndex >= maxNewIndexSoFar) {
                  maxNewIndexSoFar = newIndex
                } else {
                  moved = true
                }
                update(
                  (newBlocks[newIndex] = prevBlock),
                  ...getItem(source, newIndex),
                )
                patched++
              }
            }
          }

          // 5.3 move and mount
          // generate longest stable subsequence only when nodes have moved
          const increasingNewIndexSequence = moved
            ? getSequence(newIndexToOldIndexMap)
            : []
          j = increasingNewIndexSequence.length - 1
          // looping backwards so that we can use last patched node as anchor
          for (i = toBePatched - 1; i >= 0; i--) {
            const nextIndex = s2 + i
            const anchor =
              nextIndex + 1 < newLength
                ? normalizeAnchor(newBlocks[nextIndex + 1].nodes)
                : parentAnchor
            if (newIndexToOldIndexMap[i] === 0) {
              // mount new
              mount(source, nextIndex, anchor)
            } else if (moved) {
              // move if:
              // There is no stable subsequence (e.g. a reverse)
              // OR current node is not among the stable sequence
              if (j < 0 || i !== increasingNewIndexSequence[j]) {
                insert(newBlocks[nextIndex].nodes, parent!, anchor)
              } else {
                j--
              }
            }
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
    anchor: Node | undefined = parentAnchor,
  ): ForBlock => {
    const [item, key, index] = getItem(source, idx)
    const itemRef = shallowRef(item)
    // avoid creating refs if the render fn doesn't need it
    const keyRef = needKey ? shallowRef(key) : undefined
    const indexRef = needIndex ? shallowRef(index) : undefined

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
      getKey && getKey(item, key, index),
    ))

    if (parent) insert(block.nodes, parent, anchor)

    return block
  }

  const tryPatchIndex = (source: any, idx: number) => {
    const block = oldBlocks[idx]
    const [item, key, index] = getItem(source, idx)
    if (block.key === getKey!(item, key, index)) {
      update((newBlocks[idx] = block), item)
      return true
    }
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

  const unmount = ({ nodes, scope }: ForBlock, doRemove = true) => {
    scope && scope.stop()
    doRemove && removeBlock(nodes, parent!)
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
