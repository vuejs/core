import {
  type EffectScope,
  type ShallowRef,
  effectScope,
  shallowRef,
} from '@vue/reactivity'
import { isArray, isObject, isString } from '@vue/shared'
import {
  createComment,
  createTextNode,
  insert,
  remove as removeBlock,
} from './dom/element'
import { type Block, type Fragment, fragmentKey } from './apiRender'
import { warn } from './warning'
import { currentInstance } from './component'
import { componentKey } from './component'
import type { DynamicSlot } from './componentSlots'
import { renderEffect } from './renderEffect'
import { withMemo } from './memo'

interface ForBlock extends Fragment {
  scope: EffectScope
  state: [
    item: ShallowRef<any>,
    key: ShallowRef<any>,
    index: ShallowRef<number | undefined>,
  ]
  key: any
  memo: any[] | undefined
}

type Source = any[] | Record<any, any> | number | Set<any> | Map<any, any>

/*! #__NO_SIDE_EFFECTS__ */
export const createFor = (
  src: () => Source,
  renderItem: (block: ForBlock['state']) => Block,
  getKey?: (item: any, key: any, index?: number) => any,
  getMemo?: (item: any, key: any, index?: number) => any[],
  container?: ParentNode,
  hydrationNode?: Node,
  once?: boolean,
): Fragment => {
  let isMounted = false
  let oldBlocks: ForBlock[] = []
  let newBlocks: ForBlock[]
  let parent: ParentNode | undefined | null
  const parentAnchor = container
    ? undefined
    : __DEV__
      ? createComment('for')
      : createTextNode()
  const ref: Fragment = {
    nodes: oldBlocks,
    [fragmentKey]: true,
  }

  const instance = currentInstance!
  if (__DEV__ && !instance) {
    warn('createFor() can only be used inside setup()')
  }

  const update = getMemo ? updateWithMemo : updateWithoutMemo
  once ? renderList() : renderEffect(renderList)

  return ref

  function renderList() {
    const source = src()
    const newLength = getLength(source)
    const oldLength = oldBlocks.length
    newBlocks = new Array(newLength)

    if (!isMounted) {
      isMounted = true
      mountList(source)
    } else {
      parent = parent || container || parentAnchor!.parentNode
      if (!oldLength) {
        // fast path for all new
        mountList(source)
      } else if (!newLength) {
        // fast path for all removed
        if (container) {
          container.textContent = ''
          for (let i = 0; i < oldLength; i++) {
            oldBlocks[i].scope.stop()
          }
        } else {
          // fast path for clearing
          for (let i = 0; i < oldLength; i++) {
            unmount(oldBlocks[i])
          }
        }
      } else if (!getKey) {
        // unkeyed fast path
        const commonLength = Math.min(newLength, oldLength)
        for (let i = 0; i < commonLength; i++) {
          const [item] = getItem(source, i)
          update((newBlocks[i] = oldBlocks[i]), item)
        }
        mountList(source, oldLength)
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

    ref.nodes = [(oldBlocks = newBlocks)]
    if (parentAnchor) {
      ref.nodes.push(parentAnchor)
    }
  }

  function mount(
    source: any,
    idx: number,
    anchor: Node | undefined = parentAnchor,
  ): ForBlock {
    const scope = effectScope()

    const [item, key, index] = getItem(source, idx)
    const state = [
      shallowRef(item),
      shallowRef(key),
      shallowRef(index),
    ] as ForBlock['state']
    const block: ForBlock = (newBlocks[idx] = {
      nodes: null!, // set later
      scope,
      state,
      key: getKey && getKey(item, key, index),
      memo: getMemo && getMemo(item, key, index),
      [fragmentKey]: true,
    })
    block.nodes = scope.run(() => {
      if (getMemo) {
        return withMemo(
          () =>
            getMemo(
              block.state[0].value,
              block.state[1].value,
              block.state[2].value,
            ),
          () => renderItem(state),
        )
      }
      return renderItem(state)
    })!

    if (parent) insert(block.nodes, parent, anchor)

    return block
  }

  function mountList(source: any, offset = 0) {
    for (let i = offset; i < getLength(source); i++) {
      mount(source, i)
    }
  }

  function tryPatchIndex(source: any, idx: number) {
    const block = oldBlocks[idx]
    const [item, key, index] = getItem(source, idx)
    if (block.key === getKey!(item, key, index)) {
      update((newBlocks[idx] = block), item)
      return true
    }
  }

  function updateWithMemo(
    block: ForBlock,
    newItem: any,
    newKey = block.state[1].value,
    newIndex = block.state[2].value,
  ) {
    const [, key, index] = block.state
    let needsUpdate = newKey !== key.value || newIndex !== index.value
    if (!needsUpdate) {
      const oldMemo = block.memo!
      const newMemo = (block.memo = getMemo!(newItem, newKey, newIndex))
      for (let i = 0; i < newMemo.length; i++) {
        if ((needsUpdate = newMemo[i] !== oldMemo[i])) {
          break
        }
      }
    }

    if (needsUpdate) updateState(block, newItem, newKey, newIndex)
  }

  function updateWithoutMemo(
    block: ForBlock,
    newItem: any,
    newKey = block.state[1].value,
    newIndex = block.state[2].value,
  ) {
    const [item, key, index] = block.state
    let needsUpdate =
      newItem !== item.value || newKey !== key.value || newIndex !== index.value
    if (needsUpdate) updateState(block, newItem, newKey, newIndex)
  }

  function unmount({ nodes, scope }: ForBlock) {
    removeBlock(nodes, parent!)
    scope.stop()
  }
}

function updateState(
  block: ForBlock,
  newItem: any,
  newKey: any,
  newIndex: number | undefined,
) {
  const [item, key, index] = block.state
  item.value = newItem
  key.value = newKey
  index.value = newIndex
}

export function createForSlots(
  source: any[] | Record<any, any> | number | Set<any> | Map<any, any>,
  getSlot: (item: any, key: any, index?: number) => DynamicSlot,
): DynamicSlot[] {
  const sourceLength = getLength(source)
  const slots = new Array<DynamicSlot>(sourceLength)
  for (let i = 0; i < sourceLength; i++) {
    const [item, key, index] = getItem(source, i)
    slots[i] = getSlot(item, key, index)
  }
  return slots
}

function getLength(source: any): number {
  if (isArray(source) || isString(source)) {
    return source.length
  } else if (typeof source === 'number') {
    if (__DEV__ && !Number.isInteger(source)) {
      warn(`The v-for range expect an integer value but got ${source}.`)
    }
    return source
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      return Array.from(source as Iterable<any>).length
    } else {
      return Object.keys(source).length
    }
  }
  return 0
}

function getItem(
  source: any,
  idx: number,
): [item: any, key: any, index?: number] {
  if (isArray(source) || isString(source)) {
    return [source[idx], idx, undefined]
  } else if (typeof source === 'number') {
    return [idx + 1, idx, undefined]
  } else if (isObject(source)) {
    if (source && source[Symbol.iterator as any]) {
      source = Array.from(source as Iterable<any>)
      return [source[idx], idx, undefined]
    } else {
      const key = Object.keys(source)[idx]
      return [source[key], key, idx]
    }
  }
  return null!
}

function normalizeAnchor(node: Block): Node {
  if (node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return normalizeAnchor(node[0])
  } else if (componentKey in node) {
    return normalizeAnchor(node.block!)
  } else {
    return normalizeAnchor(node.nodes!)
  }
}

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function getSequence(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
