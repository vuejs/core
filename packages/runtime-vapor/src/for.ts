import { type EffectScope, effectScope, isReactive } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import { createComment, createTextNode, insert, remove } from './dom'
import { renderEffect } from './renderWatch'
import { type Block, type Fragment, fragmentKey } from './render'

interface ForBlock extends Fragment {
  scope: EffectScope
  item: any
  s: [any, number] // state, use short key since it's used a lot in generated code
  update: () => void
  key: any
  memo: any[] | undefined
}

export const createFor = (
  src: () => any[] | Record<string, string> | Set<any> | Map<any, any>,
  renderItem: (block: ForBlock) => Block,
  getKey?: (item: any, index: number) => any,
  getMemo?: (item: any) => any[],
  hydrationNode?: Node,
): Fragment => {
  let isMounted = false
  let oldBlocks: ForBlock[] = []
  let newBlocks: ForBlock[]
  let parent: ParentNode | undefined | null
  const parentAnchor = __DEV__ ? createComment('for') : createTextNode()
  const ref: Fragment = {
    nodes: oldBlocks,
    [fragmentKey]: true,
  }

  const mount = (
    item: any,
    index: number,
    anchor: Node = parentAnchor,
  ): ForBlock => {
    const scope = effectScope()
    // TODO support object keys etc.
    const block: ForBlock = (newBlocks[index] = {
      nodes: null as any,
      update: null as any,
      scope,
      item,
      s: [item, index],
      key: getKey && getKey(item, index),
      memo: getMemo && getMemo(item),
      [fragmentKey]: true,
    })
    block.nodes = scope.run(() => renderItem(block))!
    block.update = () => scope.effects.forEach(effect => effect.run())
    if (getMemo) block.update()
    if (parent) insert(block.nodes, parent, anchor)
    return block
  }

  const mountList = (source: any[], offset = 0) => {
    if (offset) source = source.slice(offset)
    for (let i = 0, l = source.length; i < l; i++) {
      mount(source[i], i + offset)
    }
  }

  const tryPatchIndex = (source: any[], i: number) => {
    const block = oldBlocks[i]
    const item = source[i]
    if (block.key === getKey!(item, i)) {
      update((newBlocks[i] = block), item)
      return true
    }
  }

  const update = getMemo
    ? (
        block: ForBlock,
        newItem: any,
        oldIndex = block.s[1],
        newIndex = oldIndex,
      ) => {
        let needsUpdate = newIndex !== oldIndex
        if (!needsUpdate) {
          const oldMemo = block.memo!
          const newMemo = (block.memo = getMemo(newItem))
          for (let i = 0; i < newMemo.length; i++) {
            if ((needsUpdate = newMemo[i] !== oldMemo[i])) {
              break
            }
          }
        }
        if (needsUpdate) {
          block.s = [newItem, newIndex]
          block.update()
        }
      }
    : (
        block: ForBlock,
        newItem: any,
        oldIndex = block.s[1],
        newIndex = oldIndex,
      ) => {
        if (
          newItem !== block.item ||
          newIndex !== oldIndex ||
          !isReactive(newItem)
        ) {
          block.s = [newItem, newIndex]
          block.update()
        }
      }

  const unmount = ({ nodes, scope }: ForBlock) => {
    remove(nodes, parent!)
    scope.stop()
  }

  renderEffect(() => {
    // TODO support more than arrays
    const source = src() as any[]
    const newLength = source.length
    const oldLength = oldBlocks.length
    newBlocks = new Array(newLength)

    if (!isMounted) {
      isMounted = true
      mountList(source)
    } else {
      parent = parent || parentAnchor.parentNode
      if (!oldLength) {
        // fast path for all new
        mountList(source)
      } else if (!newLength) {
        // fast path for clearing
        for (let i = 0; i < oldLength; i++) {
          unmount(oldBlocks[i])
        }
      } else if (!getKey) {
        // unkeyed fast path
        const commonLength = Math.min(newLength, oldLength)
        for (let i = 0; i < commonLength; i++) {
          update((newBlocks[i] = oldBlocks[i]), source[i])
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
              mount(source[i], i, anchor)
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
            keyToNewIndexMap.set(getKey(source[i], i), i)
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
                  source[newIndex],
                  i,
                  newIndex,
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
              mount(source[nextIndex], nextIndex, anchor)
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

    ref.nodes = [(oldBlocks = newBlocks), parentAnchor]
  })

  return ref
}

const normalizeAnchor = (node: Block): Node => {
  if (node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return normalizeAnchor(node[0])
  } else {
    return normalizeAnchor(node.nodes!)
  }
}

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
const getSequence = (arr: number[]): number[] => {
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
