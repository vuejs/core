import {
  EffectScope,
  type ShallowRef,
  isReactive,
  isReadonly,
  isShallow,
  onScopeDispose,
  setActiveSub,
  setCurrentScope,
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
  getBlockFirstNode,
  insert,
  insertFragment,
  insertNode,
  isValidSlot,
  remove,
  removeFragment,
  removeNode,
} from './block'
import { queuePostFlushCb, warn } from '@vue/runtime-dom'
import { currentInstance, isVaporComponent } from './component'
import {
  type DynamicSlot,
  type VaporSlot,
  currentSlotOwner,
  setCurrentSlotOwner,
} from './componentSlots'
import { currentSlotScopeIds, setCurrentSlotScopeIds } from './scopeId'
import { renderEffect } from './renderEffect'
import { VaporVForFlags } from '@vue/shared'
import {
  type HydrationCursor,
  advanceHydrationNode,
  currentHydrationNode,
  enterHydrationBoundary,
  enterHydrationCursor,
  exitHydrationCursor,
  isComment,
  isHydrating,
  locateHydrationBoundaryClose,
  markHydrationAnchor,
  nextLogicalSibling,
  setCurrentHydrationNode,
} from './dom/hydration'
import {
  ForBlock,
  ForFragment,
  type VaporFragment,
  isAdoptedAnchor,
  resolveFragmentAnchor,
} from './fragment'
import {
  getCurrentSlotEndAnchor,
  isPendingSlotContent,
  queuePendingSlotContentAnchor,
} from './dom/hydrateFragment'
import {
  type ChildItem,
  insertionAnchor,
  insertionIndex,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { applyTransitionHooks, isTransitionEnabled } from './transition'
import { isTeleportEnabled, isTeleportFragment } from './teleport'
import { setBlockKey } from './helpers/setKey'
import { currentSlotBoundary, setCurrentSlotBoundary } from './slotBoundary'

type Source = any[] | Record<any, any> | number | Set<any> | Map<any, any>

type ResolvedSource = {
  values: any[]
  needsWrap: boolean
  isReadonlySource: boolean
  keys?: string[]
}

type ForHydrationAnchorResolver = (
  hydrationStart: Node,
  anchorNode: Node | null | undefined,
) => Node | undefined

let resolveForHydrationAnchor: ForHydrationAnchorResolver | undefined

export function setForHydrationAnchorResolver(
  resolver: ForHydrationAnchorResolver,
): void {
  resolveForHydrationAnchor = resolver
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
): ForFragment => {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _insertionIndex = insertionIndex
  let hydrationCursor: HydrationCursor | null = null
  if (isHydrating) {
    hydrationCursor = enterHydrationCursor(true)
  } else {
    resetInsertionState()
  }

  let isMounted = false
  let oldBlocks: ForBlock[] = []
  let newBlocks: ForBlock[]
  let newKeys: any[] | undefined
  let parent: ParentNode | undefined | null
  let parentAnchor: Node
  let pendingHydrationAnchor = false
  if (!isHydrating) {
    parentAnchor = resolveFragmentAnchor(_insertionAnchor, 'for')
    if (parentAnchor === _insertionAnchor) {
      // adopted the template `<!>` placeholder as the list anchor; it is
      // already in place, so items mount directly in front of it
      parent = parentAnchor.parentNode
    }
  }

  const trackSlotBoundary = !!(flags & VaporVForFlags.SLOT_ROOT)
  const frag = new ForFragment(
    oldBlocks,
    trackSlotBoundary,
    trackSlotBoundary
      ? () => {
          const parent = parentAnchor.parentNode
          if (parent) removeNode(parentAnchor, parent)
        }
      : undefined,
  )
  const instance = currentInstance!
  const isComponent = !!(flags & VaporVForFlags.IS_COMPONENT)
  const canUseFastRemove =
    !!(flags & VaporVForFlags.FAST_REMOVE) && !isComponent
  const isSingleNode = !!(flags & VaporVForFlags.IS_SINGLE_NODE)
  const isFragment = !!(flags & VaporVForFlags.IS_FRAGMENT)

  const slotOwner = currentSlotOwner
  const slotBoundary = currentSlotBoundary
  const slotScopeIds = currentSlotScopeIds

  if (__DEV__ && !instance) {
    warn('createFor() can only be used inside setup()')
  }

  onScopeDispose(() => {
    stopBlockScopes(oldBlocks)
    if (newBlocks && newBlocks !== oldBlocks) {
      stopBlockScopes(newBlocks)
    }
    oldBlocks = []
    newBlocks = []
  }, true)

  const renderList = () => {
    const source = normalizeSource(src())
    const sourceKeys = source.keys
    const newLength = source.values.length
    const oldLength = oldBlocks.length
    newBlocks = new Array(newLength)
    // Key expressions can depend on item fields, not just list shape. Evaluate
    // them while the render effect is still the active subscriber so those deps
    // can trigger keyed diff, then reuse the same keys below after
    // setActiveSub() clears the active subscriber during patching.
    newKeys = undefined
    if (getKey) {
      newKeys = new Array(newLength)
      for (let i = 0; i < newLength; i++) {
        newKeys[i] = sourceKeys
          ? getKey(getItemValue(source, i), sourceKeys[i], i)
          : getKey(getItemValue(source, i), i, undefined)
      }
    }

    const prevSub = setActiveSub()
    const wasMounted = isMounted
    if (wasMounted && frag.onBeforeUpdate) {
      for (let i = 0; i < frag.onBeforeUpdate.length; i++) {
        frag.onBeforeUpdate[i]()
      }
    }
    if (!wasMounted) {
      isMounted = true
      if (isHydrating) {
        hydrateList(source, newLength)
      } else {
        mountAll(source, newLength)
      }
    } else {
      parent = parentAnchor!.parentNode
      if (!oldLength) {
        // fast path for all new
        mountAll(source, newLength)
      } else if (!newLength) {
        // fast path for clearing all.
        // Fire reset listeners BEFORE per-item unmount so attached selectors
        // bump their generation counter; the subsequent block.scope.stop()
        // calls then short-circuit their onScopeDispose deregisters instead
        // of doing N individual Map.delete() ops.
        if (frag.resetListeners) {
          for (const fn of frag.resetListeners) fn()
        }
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
          updateAt((newBlocks[i] = oldBlocks[i]), source, i)
        }
        for (let i = oldLength; i < newLength; i++) {
          mountAt(source, i)
        }
        for (let i = newLength; i < oldLength; i++) {
          unmount(oldBlocks[i])
        }
      } else {
        if (__DEV__) {
          const keyToIndexMap: Map<any, number> = new Map()
          for (let i = 0; i < newLength; i++) {
            const key = newKeys![i]
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
        let endOffset = 0
        let queuedLength = 0

        while (endOffset < commonLength) {
          const index = newLength - endOffset - 1
          const key = newKeys![index]
          const existingBlock = oldBlocks[oldLength - endOffset - 1]
          if (existingBlock.key !== key) break
          updateAt(existingBlock, source, index)
          newBlocks[index] = existingBlock
          endOffset++
        }

        const e1 = commonLength - endOffset
        const e2 = oldLength - endOffset
        const e3 = newLength - endOffset

        // parallel arrays holding blocks that need a mount or a move, in
        // ascending index order; the suffix scan above already excluded
        // everything from e3 on. After the reuse pass `queuedOldIndex[q]`
        // distinguishes them: the block's old position for a reuse (its
        // ForBlock is already in `newBlocks`), or -1 for a fresh mount.
        const queuedIndices: number[] = new Array(e3)
        const queuedOldIndex: number[] = new Array(e3)

        const oldKeyIndexMap = new Map<any, number>()

        for (let i = 0; i < e1; i++) {
          const currentKey = newKeys![i]
          const oldBlock = oldBlocks[i]
          if (oldBlock.key === currentKey) {
            updateAt((newBlocks[i] = oldBlock), source, i)
          } else {
            queuedIndices[queuedLength++] = i
            oldKeyIndexMap.set(oldBlock.key, i)
          }
        }

        for (let i = e1; i < e2; i++) {
          oldKeyIndexMap.set(oldBlocks[i].key, i)
        }

        for (let i = e1; i < e3; i++) {
          queuedIndices[queuedLength++] = i
        }

        let mountCounter = 0

        for (let q = queuedLength - 1; q >= 0; q--) {
          const index = queuedIndices[q]
          const key = newKeys![index]
          const oldIndex = oldKeyIndexMap.get(key)
          if (oldIndex !== undefined) {
            oldKeyIndexMap.delete(key)
            const reusedBlock = (newBlocks[index] = oldBlocks[oldIndex])
            updateAt(reusedBlock, source, index)
            queuedOldIndex[q] = oldIndex
          } else {
            queuedOldIndex[q] = -1
            mountCounter++
          }
        }

        const useFastRemove = mountCounter === newLength

        // Same ordering note as the !newLength path: reset before unmount so
        // the generation bump turns per-item deregisters into no-ops.
        if (useFastRemove && frag.resetListeners) {
          for (const fn of frag.resetListeners) fn()
        }
        for (const leftoverIndex of oldKeyIndexMap.values()) {
          unmount(
            oldBlocks[leftoverIndex],
            !(useFastRemove && canUseFastRemove),
          )
        }
        if (useFastRemove && canUseFastRemove) {
          parent!.textContent = ''
          parent!.appendChild(parentAnchor)
        }

        // Decide which reused blocks may stay in place. In-place matched
        // (stationary) blocks partition the queued indices into segments of
        // consecutive positions; within a segment, the longest increasing
        // subsequence of old indices — bounded by the old positions of the
        // stationary neighbors — is already in relative order, so only the
        // blocks outside it need a DOM move.
        //
        // This is a heuristic, not a minimum: pinning every stationary block
        // is what keeps the cost O(queued) rather than O(length), so a
        // near-untouched list (a two-row swap, a single removal) does almost
        // no work here — but a coincidental in-place match inside an
        // otherwise heavily shuffled range splits a segment and can cost
        // more moves than vdom's unpinned whole-range LIS.
        let keep: boolean[] | undefined
        if (mountCounter !== queuedLength) {
          keep = new Array(queuedLength)
          const tailValues: number[] = []
          const tailPositions: number[] = []
          const lisParent: number[] = new Array(queuedLength)
          let seg = 0
          while (seg < queuedLength) {
            let segEnd = seg
            while (
              segEnd + 1 < queuedLength &&
              queuedIndices[segEnd + 1] === queuedIndices[segEnd] + 1
            ) {
              segEnd++
            }
            // prefix stationaries sit at their own index in both lists; the
            // first suffix stationary (index e3) sits at old index e2. With
            // no bounding stationary the bounds are -1 / e2 == oldLength.
            const lowerBound = queuedIndices[seg] - 1
            const nextIndex = queuedIndices[segEnd] + 1
            const upperBound = nextIndex < e3 ? nextIndex : e2
            tailValues.length = tailPositions.length = 0
            for (let q = seg; q <= segEnd; q++) {
              keep[q] = false
              const oldIndex = queuedOldIndex[q]
              if (
                oldIndex <= lowerBound ||
                oldIndex >= upperBound ||
                oldIndex < 0
              ) {
                continue
              }
              let lo = 0
              let hi = tailValues.length
              while (lo < hi) {
                const mid = (lo + hi) >> 1
                if (tailValues[mid] < oldIndex) lo = mid + 1
                else hi = mid
              }
              tailValues[lo] = oldIndex
              lisParent[q] = lo > 0 ? tailPositions[lo - 1] : -1
              tailPositions[lo] = q
            }
            for (
              let q = tailValues.length
                ? tailPositions[tailValues.length - 1]
                : -1;
              q !== -1;
              q = lisParent[q]
            ) {
              keep[q] = true
            }
            seg = segEnd + 1
          }
        }

        // Rows removed under a leave transition stay in the DOM until the
        // animation ends. Only the tail needs special handling: a row landing
        // at the end would otherwise be inserted at `parentAnchor`, i.e.
        // *after* those still-animating rows, which reorders them relative to
        // a surviving neighbor they used to follow. Mid-list insertions anchor
        // on the next live row, matching vdom (which never steps over leaving
        // elements either), so ghosts keep their place there.
        // Only a row landing at the tail while a leave transition is running
        // needs the ghost set, so it is built on first use rather than per
        // patch (lists without <TransitionGroup> never build it at all).
        const hasGhosts = isTransitionEnabled && !!frag.$transition
        let tailGhostNodes: Set<Node> | undefined

        // apply back-to-front so every block can anchor on the finalized
        // block after it (kept blocks count as finalized: relative order
        // among all unmoved blocks is already correct)
        for (let q = queuedLength - 1; q >= 0; q--) {
          const isReuse = queuedOldIndex[q] >= 0
          if (isReuse && keep![q]) continue
          const index = queuedIndices[q]

          // A block that renders nothing has no first node, so look past it
          // for the next attached one.
          let anchorNode: Node | undefined
          for (let i = index + 1; i < newLength; i++) {
            const node = getBlockFirstNode(newBlocks[i].nodes)
            if (node && node.parentNode) {
              anchorNode = node
              break
            }
          }

          if (anchorNode === undefined) {
            // landing at the tail: step in front of rows still leaving, which
            // `parentAnchor` alone would place this row after
            anchorNode = parentAnchor
            if (hasGhosts) {
              if (!tailGhostNodes) {
                tailGhostNodes = new Set()
                for (const leftoverIndex of oldKeyIndexMap.values()) {
                  const nodes = oldBlocks[leftoverIndex].nodes
                  if (isSingleNode) {
                    tailGhostNodes.add(nodes as Node)
                  } else {
                    collectBlockNodes(nodes, tailGhostNodes)
                  }
                }
              }
              let prev = anchorNode.previousSibling
              while (prev && tailGhostNodes.has(prev)) {
                anchorNode = prev
                prev = prev.previousSibling
              }
            }
          }

          if (isReuse) {
            insertForBlock(newBlocks[index], anchorNode)
          } else {
            mount(
              source,
              index,
              anchorNode,
              getItemValue(source, index),
              newKeys![index],
            )
          }
        }
      }
    }

    frag.nodes = [(oldBlocks = newBlocks)]
    if (parentAnchor) frag.nodes.push(parentAnchor)

    if (wasMounted && frag.onUpdated) frag.onUpdated.forEach(m => m())
    setActiveSub(prevSub)
  }

  const needKey = renderItem.length > 1
  const needIndex = renderItem.length > 2

  type InsertForBlock = (block: ForBlock, anchor: Node | undefined) => void
  // IS_COMPONENT requires component teardown ordering but does not guarantee
  // that block.nodes is a VaporComponentInstance. Component fallback may
  // produce a plain DOM node, so these blocks still use the generic block path.
  const insertForBlock: InsertForBlock = isSingleNode
    ? (block, anchor) => insertNode(block.nodes as Node, parent!, anchor)
    : isFragment
      ? (block, anchor) =>
          insertFragment(block.nodes as VaporFragment, parent!, anchor)
      : (block, anchor) => insert(block.nodes, parent!, anchor)

  type RemoveForBlock = (block: ForBlock) => void
  const removeForBlock: RemoveForBlock = isSingleNode
    ? block => removeNode(block.nodes as Node, parent!)
    : isFragment
      ? block => removeFragment(block.nodes as VaporFragment, parent!)
      : block => remove(block.nodes, parent!)

  const mount = (
    source: ResolvedSource,
    idx: number,
    anchor: Node | undefined,
    item: any,
    key2: any,
  ): ForBlock => {
    const keys = source.keys
    const itemRef = shallowRef(item)
    // avoid creating refs if the render fn doesn't need it
    const keyRef = needKey ? shallowRef(keys ? keys[idx] : idx) : undefined
    const indexRef = needIndex ? shallowRef(keys ? idx : undefined) : undefined

    let nodes: Block
    const scope = new EffectScope(true)
    const prevScope = setCurrentScope(scope)
    try {
      nodes = renderItem(itemRef, keyRef as any, indexRef as any)
    } catch (err) {
      // restore before stopping so scope cleanups never observe the dying
      // scope as current (matches the previous scope.run() ordering)
      setCurrentScope(prevScope)
      scope.stop()
      throw err
    } finally {
      setCurrentScope(prevScope)
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
    if (isTransitionEnabled && frag.$transition) {
      if (frag.$transition.applyGroup) setBlockKey(block.nodes, block.key)
      applyTransitionHooks(block.nodes, frag.$transition)
    }

    if (parent) {
      insertForBlock(block, anchor)
    }

    return block
  }

  const mountAt = (source: ResolvedSource, idx: number): ForBlock =>
    mount(
      source,
      idx,
      parentAnchor,
      getItemValue(source, idx),
      newKeys ? newKeys[idx] : undefined,
    )

  const mountAll = (source: ResolvedSource, newLength: number): void => {
    for (let i = 0; i < newLength; i++) {
      mountAt(source, i)
    }
  }

  const updateAt = (
    block: ForBlock,
    source: ResolvedSource,
    idx: number,
  ): void => {
    const keys = source.keys
    update(
      block,
      getItemValue(source, idx),
      keys ? keys[idx] : idx,
      keys ? idx : undefined,
    )
  }

  function hydrateList(source: ResolvedSource, newLength: number): void {
    const hydrationStart = currentHydrationNode!
    let exitHydrationBoundary: (() => void) | undefined
    let nextNode
    const emptyLocalRange =
      isComment(hydrationStart, ']') &&
      isComment(hydrationStart.previousSibling!, '[')
    const slotEndAnchor = getCurrentSlotEndAnchor()
    const slotFallbackRange = isPendingSlotContent() && slotEndAnchor

    const reuseBoundaryClose = (close: Node): void => {
      parentAnchor = markHydrationAnchor(close)
      exitHydrationBoundary = enterHydrationBoundary(parentAnchor)
    }

    try {
      if (emptyLocalRange && newLength) {
        reuseBoundaryClose(hydrationStart)
        for (let i = 0; i < newLength; i++) {
          mountAt(source, i)
        }
        setCurrentHydrationNode(parentAnchor)
      } else {
        for (let i = 0; i < newLength; i++) {
          if (isComment(currentHydrationNode!, ']')) {
            nextNode = markHydrationAnchor(currentHydrationNode!)
            setCurrentHydrationNode(nextNode)
          } else {
            nextNode = nextLogicalSibling(currentHydrationNode!)
          }
          mountAt(source, i)
          if (nextNode) setCurrentHydrationNode(nextNode)
        }

        // special handling transition-group + v-for, without <!--]--> marker
        const resolvedAnchor =
          resolveForHydrationAnchor &&
          resolveForHydrationAnchor(
            hydrationStart,
            newLength ? nextNode : currentHydrationNode,
          )
        if (resolvedAnchor) {
          parentAnchor = resolvedAnchor
          pendingHydrationAnchor = true
        } else if (slotFallbackRange && !isValidSlot(newBlocks)) {
          // Slot fallback can fall through an empty/invalid `v-for`. In that
          // case SSR only rendered the parent slot range, so this `v-for` has no
          // own `<!--]-->` to reuse. Keep its runtime anchor detached if
          // fallback wins; if content wins, insert it at the local slot-content
          // boundary below.
          const anchor =
            // The invalid list still consumed local SSR item ranges.
            currentHydrationNode !== hydrationStart
              ? currentHydrationNode!
              : // Empty source with trailing slot siblings.
                hydrationStart !== slotEndAnchor
                ? hydrationStart.nextSibling!
                : slotEndAnchor!
          parentAnchor = markHydrationAnchor(
            __DEV__ ? createComment('for') : createTextNode(),
          )
          const hydrationAnchor = parentAnchor
          pendingHydrationAnchor = true
          if (
            currentHydrationNode === hydrationStart ||
            currentHydrationNode === slotEndAnchor
          ) {
            setCurrentHydrationNode(hydrationStart)
          }
          const attachAnchor = () => {
            const parentNode = anchor.parentNode
            if (parentNode) parentNode.insertBefore(hydrationAnchor, anchor)
          }
          const queued = queuePendingSlotContentAnchor({
            onContent: () => queuePostFlushCb(attachAnchor),
            onFallback: () => {},
          })
          if (!queued) queuePostFlushCb(attachAnchor)
        } else {
          const close = locateHydrationBoundaryClose(currentHydrationNode!)
          reuseBoundaryClose(close)
          if (__DEV__ && !isComment(parentAnchor, ']')) {
            throw new Error(
              `v-for fragment anchor node was not found. this is likely a Vue internal bug.`,
            )
          }

          // optimization: cache the fragment end anchor as $llc (last logical child)
          // so that locateChildByLogicalIndex can skip the entire fragment.
          // For anchored inserts, reuse the unit index the locator stamped on
          // the anchor; if it is unstamped (reached via a cache-missed
          // `next()`), leave `$llc` untouched — `0` is a valid unit index, so
          // a fallback would alias a stale cache entry to "unit 0", while
          // skipping the install only costs a restart walk.
          if (_insertionParent && isComment(parentAnchor, ']')) {
            const idx = _insertionAnchor
              ? (_insertionAnchor as any as ChildItem).$idx
              : _insertionIndex || 0
            if (idx !== undefined) {
              ;(parentAnchor as any as ChildItem).$idx = idx
              _insertionParent.$llc = parentAnchor
            }
          }
        }
      }
    } finally {
      exitHydrationBoundary && exitHydrationBoundary()
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

  const unmount = (block: ForBlock, doRemove = true) => {
    if (!isComponent) {
      block.scope!.stop()
    }
    if (doRemove) {
      removeForBlock(block)
    }
    if (isComponent) {
      // Component item cleanups such as template refs must observe the
      // component after structural removal.
      block.scope!.stop()
    }
  }

  if (flags & VaporVForFlags.ONCE) {
    renderList()
  } else {
    renderEffect(() => {
      if (!isMounted) return renderList()
      const prevOwner = setCurrentSlotOwner(slotOwner)
      const restoreBoundary = currentSlotBoundary !== slotBoundary
      const prevBoundary = restoreBoundary
        ? setCurrentSlotBoundary(slotBoundary)
        : null
      const prevSlotScopeIds = setCurrentSlotScopeIds(slotScopeIds)
      try {
        renderList()
      } finally {
        setCurrentSlotScopeIds(prevSlotScopeIds)
        if (restoreBoundary) setCurrentSlotBoundary(prevBoundary)
        setCurrentSlotOwner(prevOwner)
      }
    })
  }

  if (!isHydrating) {
    // adopted lists mount their items in place through the template anchor
    if (_insertionParent && !isAdoptedAnchor(parentAnchor!, _insertionAnchor)) {
      insert(frag, _insertionParent, _insertionAnchor)
    }
  } else {
    if (!pendingHydrationAnchor && currentHydrationNode === parentAnchor!) {
      advanceHydrationNode(parentAnchor!)
    }
    exitHydrationCursor(hydrationCursor)
  }

  return frag
}

export interface ForSelector {
  (key: any, oper: () => void): void
  /**
   * Bulk-reset the selector's internal state. Hook into a v-for's fast-reset
   * paths via `forFragment.onReset(selector.reset)` so the lazy per-item
   * `onScopeDispose` teardowns short-circuit instead of doing N individual
   * Map.delete() calls.
   */
  reset(): void
}

/**
 * Builds a key-indexed selector that activates only the opers registered with
 * the key matching the current source value. Compared to letting each item
 * subscribe directly, this keeps re-renders on source change O(2) instead of
 * O(N) (only previous and new active item re-run).
 *
 * Selector cleanup follows the current scope. Per-item teardown is auto-wired
 * via `onScopeDispose` so callers (typically v-for item scopes) don't need
 * explicit deregistration. For bulk-reset hot paths, attach the selector to
 * the v-for via `frag.onReset(selector.reset)` to skip the per-item Map ops.
 */
export function createSelector(source: () => any): ForSelector {
  const operMap = new Map<any, (() => void)[]>()
  let activeKey = source()
  let activeOpers: (() => void)[] | undefined
  let pendingKey = activeKey
  let pending = false
  // bumped by reset(); register captures the current value and uses it as
  // a stale-check so post-reset deregisters become no-ops
  let generation = 0

  watch(source, newValue => {
    pendingKey = newValue
    if (pending) return
    pending = true

    if (activeOpers !== undefined) {
      for (const oper of activeOpers) {
        oper()
      }
    }

    // watch may trigger before list patched
    // defer to post-flush so operMap is up to date
    queuePostFlushCb(() => {
      pending = false
      activeKey = pendingKey
      activeOpers = operMap.get(activeKey)
      if (activeOpers !== undefined) {
        for (const oper of activeOpers) {
          oper()
        }
      }
    })
  })

  const register: ForSelector = (key, oper) => {
    oper()
    let opers = operMap.get(key)
    if (opers !== undefined) {
      opers.push(oper)
    } else {
      opers = [oper]
      operMap.set(key, opers)
      if (key === activeKey) {
        activeOpers = opers
      }
    }
    const myGen = generation
    onScopeDispose(() => {
      if (myGen !== generation) return // bulk-cleared, skip
      const list = operMap.get(key)
      if (list === undefined) return
      if (list.length === 1) {
        operMap.delete(key)
        if (key === activeKey) activeOpers = undefined
      } else {
        const idx = list.indexOf(oper)
        if (idx !== -1) list.splice(idx, 1)
      }
    }, true)
  }
  register.reset = () => {
    operMap.clear()
    activeOpers = undefined
    generation++
  }
  return register
}

// Collects a block's own nodes in the main view, so a sibling walk can tell
// which nodes belong to a row that is still leaving.
function collectBlockNodes(block: Block, set: Set<Node>): void {
  if (!block) {
    return
  } else if (block instanceof Node) {
    set.add(block)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      collectBlockNodes(block[i], set)
    }
  } else if (isVaporComponent(block)) {
    if (block.block) collectBlockNodes(block.block, set)
  } else if (isTeleportEnabled && isTeleportFragment(block)) {
    // teleported content lives in the target container; only the main-view
    // markers can appear as siblings here
    if (block.placeholder) set.add(block.placeholder)
    if (block.anchor) set.add(block.anchor)
  } else {
    collectBlockNodes(block.nodes, set)
    if (block.anchor) set.add(block.anchor)
  }
}

function stopBlockScopes(blocks: ForBlock[]): void {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block) {
      const scope = block.scope
      if (scope) scope.stop()
    }
  }
}

function isSameMapKey(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || (a === 0 && b === 0)
}

export function createForSlots(
  rawSource: () => Source,
  renderSlot: (
    item: ShallowRef,
    key?: ShallowRef,
    index?: ShallowRef,
  ) => VaporSlot,
  getName: (item: any, key: any, index?: number) => unknown,
  getKey?: (item: any, key: any, index?: number) => unknown,
): () => DynamicSlot[] {
  type SlotRecord = DynamicSlot & {
    rawIdentity: unknown
    itemRef: ShallowRef
    keyRef?: ShallowRef
    indexRef?: ShallowRef
  }

  let oldRecords: SlotRecord[] = []
  const needKey = renderSlot.length > 1
  const needIndex = renderSlot.length > 2

  const update = (
    record: SlotRecord,
    [item, key, index]: ReturnType<typeof getItem>,
  ) => {
    if (!Object.is(record.itemRef.value, item)) {
      record.itemRef.value = item
    }
    if (record.keyRef && !Object.is(record.keyRef.value, key)) {
      record.keyRef.value = key
    }
    if (record.indexRef && !Object.is(record.indexRef.value, index)) {
      record.indexRef.value = index
    }
  }

  return () => {
    const source = normalizeSource(rawSource())
    const sourceLength = source.values.length
    const names = new Array<string>(sourceLength)
    const identities: unknown[] = getKey
      ? new Array<unknown>(sourceLength)
      : names
    const items = new Array<ReturnType<typeof getItem>>(sourceLength)
    let sameResolution = sourceLength === oldRecords.length

    for (let i = 0; i < sourceLength; i++) {
      const item = (items[i] = getItem(source, i))
      const name = (names[i] = String(getName(...item)))
      const identity = (identities[i] = getKey ? getKey(...item) : name)
      if (
        sameResolution &&
        (!isSameMapKey(oldRecords[i].rawIdentity, identity) ||
          oldRecords[i].name !== name)
      ) {
        sameResolution = false
      }
    }

    if (sameResolution) {
      const prevSub = setActiveSub()
      for (let i = sourceLength - 1; i >= 0; i--) {
        update(oldRecords[i], items[i])
      }
      setActiveSub(prevSub)
      return oldRecords
    }

    const oldByIdentity = new Map<unknown, SlotRecord>()
    for (let i = 0; i < oldRecords.length; i++) {
      oldByIdentity.set(oldRecords[i].rawIdentity, oldRecords[i])
    }

    const records = new Array<SlotRecord>(sourceLength)
    const prevSub = setActiveSub()
    for (let i = sourceLength - 1; i >= 0; i--) {
      const slotItem = items[i]
      const rawIdentity = identities[i]
      let record = oldByIdentity.get(rawIdentity)
      if (record) {
        oldByIdentity.delete(rawIdentity)
        update(record, slotItem)
        record.name = names[i]
      } else {
        const [item, key, index] = slotItem
        const itemRef = shallowRef(item)
        const keyRef = needKey ? shallowRef(key) : undefined
        const indexRef = needIndex ? shallowRef(index) : undefined
        record = {
          rawIdentity,
          itemRef,
          keyRef,
          indexRef,
          name: names[i],
          fn: renderSlot(itemRef, keyRef, indexRef),
          // The item ref is stable for the lifetime of this slot record.
          key: itemRef,
        }
      }
      records[i] = record
    }
    setActiveSub(prevSub)
    oldRecords = records
    return records
  }
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
    if (__DEV__ && (!Number.isInteger(source) || source < 0)) {
      warn(
        `The v-for range expects a positive integer value but got ${source}.`,
      )
      values = []
    } else {
      values = new Array(source)
      for (let i = 0; i < source; i++) values[i] = i + 1
    }
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

function getItemValue(
  { values, needsWrap, isReadonlySource }: ResolvedSource,
  idx: number,
): any {
  return needsWrap
    ? isReadonlySource
      ? toReadonly(toReactive(values[idx]))
      : toReactive(values[idx])
    : values[idx]
}

function getItem(
  source: ResolvedSource,
  idx: number,
): [item: any, key: any, index?: number] {
  const value = getItemValue(source, idx)
  if (source.keys) {
    return [value, source.keys[idx], idx]
  } else {
    return [value, idx, undefined]
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

export function getDefaultValue(val: any, getDefaultVal: () => any): any {
  return val === undefined ? getDefaultVal() : val
}
