import { EffectScope, type ShallowRef, setActiveSub } from '@vue/reactivity'
import {
  createComment,
  createTextNode,
  parentNode as getParentNode,
} from './dom/node'
import {
  type Block,
  type BlockFn,
  type TransitionOptions,
  type VaporTransitionHooks,
  findBlockNode,
  insert,
  isValidBlock,
  remove,
  removeNode,
} from './block'
import {
  type GenericComponentInstance,
  type TransitionHooks,
  type VNode,
  currentInstance,
  queuePostFlushCb,
  setCurrentInstance,
} from '@vue/runtime-dom'
import { type VaporComponentInstance, isVaporComponent } from './component'
import type { NodeRef } from './apiTemplateRef'
import {
  advanceHydrationNode,
  cleanupHydrationTail,
  currentHydrationNode,
  enterHydrationBoundary,
  isComment,
  isHydrating,
  isInDeferredHydrationBoundary,
  locateEndAnchor,
  locateHydrationBoundaryClose,
  locateHydrationNode,
  markHydrationAnchor,
  nextLogicalSibling,
  setCurrentHydrationNode,
} from './dom/hydration'
import { EMPTY_ARR, isArray } from '@vue/shared'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots'
import { setBlockKey } from './helpers/setKey'
import {
  type VaporKeepAliveContext,
  currentKeepAliveCtx,
  isKeepAliveEnabled,
  setCurrentKeepAliveCtx,
  withCurrentCacheKey,
} from './keepAlive'
import {
  applyTransitionHooks,
  applyTransitionLeaveHooks,
  isTransitionEnabled,
  isVaporTransition,
} from './transition'

const EMPTY_BLOCK = EMPTY_ARR as unknown as Block[]

export class VaporFragment<
  T extends Block = Block,
> implements TransitionOptions {
  $key?: any
  $transition?: VaporTransitionHooks | undefined
  nodes: T
  vnode?: VNode | null
  anchor?: Node
  parentComponent?: GenericComponentInstance | null
  // Async component fragments are valid while waiting for resolved output.
  validityPending?: boolean
  isBlockValid?: () => boolean
  insert?: (
    parent: ParentNode,
    anchor: Node | null,
    transitionHooks?: TransitionHooks,
  ) => void
  remove?: (parent?: ParentNode, transitionHooks?: TransitionHooks) => void
  hydrate?(...args: any[]): void
  setRef?: (
    instance: VaporComponentInstance,
    ref: NodeRef,
    refFor: boolean,
    refKey: string | undefined,
  ) => void

  // hooks
  onBeforeInsert?: ((nodes: Block) => void)[]
  // Return true to keep the branch scope alive after removing its DOM.
  onBeforeRemove?: ((scope: EffectScope) => boolean)[]
  onBeforeUpdate?: (() => void)[]
  onUpdated?: ((nodes?: Block) => void)[]

  // render context
  readonly renderInstance: GenericComponentInstance | null = currentInstance
  readonly slotOwner: VaporComponentInstance | null = currentSlotOwner
  readonly keepAliveCtx?: VaporKeepAliveContext | null
  readonly inheritedSlotBoundary: SlotBoundaryContext | null =
    currentSlotBoundary

  constructor(nodes: T) {
    this.nodes = nodes
    if (isKeepAliveEnabled) {
      this.keepAliveCtx = currentKeepAliveCtx
    }
  }

  protected runWithRenderCtx<R>(fn: () => R, scope?: EffectScope): R {
    const prevInstance = setCurrentInstance(this.renderInstance, scope)
    const keepAliveCtx = isKeepAliveEnabled ? this.keepAliveCtx || null : null
    // When ambient fragment context already matches, only instance/scope needs
    // restoring. This keeps ordinary branch renders on the cheap path.
    if (
      currentSlotOwner === this.slotOwner &&
      currentSlotBoundary === this.inheritedSlotBoundary &&
      (!isKeepAliveEnabled || currentKeepAliveCtx === keepAliveCtx)
    ) {
      try {
        return fn()
      } finally {
        setCurrentInstance(...prevInstance)
      }
    }

    const prevSlotOwner = setCurrentSlotOwner(this.slotOwner)
    let prevKeepAliveCtx: VaporKeepAliveContext | null = null
    if (isKeepAliveEnabled) {
      prevKeepAliveCtx = setCurrentKeepAliveCtx(keepAliveCtx)
    }
    const prevBoundary = setCurrentSlotBoundary(this.inheritedSlotBoundary)
    try {
      return fn()
    } finally {
      setCurrentSlotBoundary(prevBoundary)
      if (isKeepAliveEnabled) {
        setCurrentKeepAliveCtx(prevKeepAliveCtx)
      }
      setCurrentSlotOwner(prevSlotOwner)
      setCurrentInstance(...prevInstance)
    }
  }
}

export class ForFragment extends VaporFragment<Block[]> {
  // Listeners fired when the v-for resets its items in one shot
  // (whole-list clear or full remount). Selectors hook in here via
  // `frag.onReset(selector.reset)` so they can drop their internal state in
  // O(1) instead of N per-item Map.delete calls.
  resetListeners?: (() => void)[]

  constructor(nodes: Block[], trackSlotBoundary: boolean) {
    super(nodes)
    if (trackSlotBoundary) trackSlotBoundaryDirtying(this)
  }

  onReset(fn: () => void): void {
    ;(this.resetListeners ||= []).push(fn)
  }
}

export class ForBlock extends VaporFragment {
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

const enum CloseAnchorOwner {
  None,
  Self,
  ParentBefore,
  ParentAfter,
}

function getDynamicCloseOwner(
  isSlot: boolean,
  forwardedSlot: boolean,
  anchorLabel: string | undefined,
  nodes: Block,
  currentSlotEndAnchor: Node | null,
): CloseAnchorOwner {
  // Slot fragments own the close marker unless this is an empty forwarded slot.
  // Empty forwarded slots must leave the close marker to the parent boundary
  // and create their runtime anchor after it.
  if (isSlot) {
    if (!forwardedSlot) return CloseAnchorOwner.Self
    return isValidBlock(nodes)
      ? CloseAnchorOwner.Self
      : CloseAnchorOwner.ParentAfter
  }

  // SSR wraps multi-root `v-if` branches in a fragment range, so the closing
  // `<!--]-->` belongs to the branch itself.
  if (anchorLabel === 'if' && isArray(nodes) && nodes.length > 1) {
    return CloseAnchorOwner.Self
  }

  // Slot fallback can fall through an inner `v-if`. When the `if` resolves
  // to an invalid block and the fallback is selected, the `if` still needs
  // its own runtime anchor instead of reusing the parent slot's end anchor.
  if (
    anchorLabel === 'if' &&
    currentSlotEndAnchor &&
    isHydratingSlotFallbackActive() &&
    !isValidBlock(nodes)
  ) {
    return CloseAnchorOwner.ParentBefore
  }

  return CloseAnchorOwner.None
}

function queueAnchorInsert(
  parentNode: Node,
  nextNode: Node | null,
  createAnchor: () => Node,
): void {
  // Create the runtime anchor only after insertion is flushed so traversal
  // cannot observe a detached anchor too early.
  queuePostFlushCb(() => {
    const anchor =
      nextNode && getParentNode(nextNode) === parentNode ? nextNode : null
    parentNode.insertBefore(createAnchor(), anchor)
  })
}

export class DynamicFragment extends VaporFragment {
  // @ts-expect-error - assigned in hydrate()
  anchor: Node
  scope: EffectScope | undefined
  current?: BlockFn
  pending?: { render?: BlockFn; key: any; noScope: boolean }
  anchorLabel?: string
  keyed?: boolean
  inTransition?: boolean
  // Fallthrough attrs hooks register branch-owned effects on insert.
  hasFallthroughAttrs?: true
  constructor(
    anchorLabel?: string,
    keyed: boolean = false,
    locate: boolean = true,
    trackSlotBoundary: boolean = false,
  ) {
    super(EMPTY_BLOCK)
    if (keyed) this.keyed = true
    if (
      isTransitionEnabled &&
      currentInstance &&
      isVaporTransition(currentInstance.type)
    ) {
      this.inTransition = true
    }
    if (isHydrating) {
      this.anchorLabel = anchorLabel
      if (locate) locateHydrationNode()
    } else {
      this.anchor =
        __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
      if (__DEV__) this.anchorLabel = anchorLabel
    }
    if (trackSlotBoundary) trackSlotBoundaryDirtying(this)
  }

  update(
    render?: BlockFn,
    key: any = render,
    noScope: boolean = false,
    shouldInsert: boolean = true,
  ): void {
    if (key === this.current) {
      // On initial hydration, `key === current` means `render` is empty,
      // so this fragment hydrates as empty content.
      if (isHydrating && this.anchorLabel !== 'slot') this.hydrate(true)
      return
    }

    const transition = isTransitionEnabled ? this.$transition : undefined
    // currently leaving: defer mounting the next branch until
    // the leave finishes.
    if (transition && transition.state.isLeaving) {
      // Track the latest target key immediately so repeated updates during
      // leave keep overwriting the pending branch instead of reviving stale
      // keys when the deferred render finally runs.
      this.current = key
      const pending = this.pending
      if (pending) {
        pending.render = render
        pending.key = key
        pending.noScope = noScope
      } else {
        this.pending = { render, key, noScope }
      }
      return
    }

    const instance = currentInstance
    const prevSub = setActiveSub()
    const parent = !isHydrating && shouldInsert ? this.anchor.parentNode : null
    const wasMounted = this.current !== undefined
    // teardown previous branch
    if (wasMounted) {
      const scope = this.scope
      if (scope) {
        let retainScope = false
        const onBeforeRemove = this.onBeforeRemove
        if (onBeforeRemove) {
          for (let i = 0; i < onBeforeRemove.length; i++) {
            retainScope = onBeforeRemove[i](scope) || retainScope
          }
        }
        if (!retainScope) {
          scope.stop()
        }
      }
      const mode = transition && transition.mode

      if (
        mode &&
        // in-out only works when there is an incoming branch to trigger
        // delayedLeave; otherwise the current branch should leave immediately.
        (mode !== 'in-out' || (mode === 'in-out' && render)) &&
        // out-in only needs to defer when the current branch actually has
        // a rendered child to leave before mounting the next one.
        (mode !== 'out-in' || isValidBlock(this.nodes))
      ) {
        applyTransitionLeaveHooks(this.nodes, transition, () => {
          // By the time this deferred out-in branch runs, the renderEffect
          // has finished and currentInstance may have changed, so restore
          // the captured instance.
          const prevInstance = setCurrentInstance(instance)
          try {
            const pending = this.pending
            if (pending) {
              this.pending = undefined
              this.renderBranch(
                pending.render,
                transition,
                parent,
                pending.key,
                pending.noScope,
                true,
              )
            } else {
              this.renderBranch(render, transition, parent, key, noScope, true)
            }
          } finally {
            setCurrentInstance(...prevInstance)
          }
        })
        parent && remove(this.nodes, parent)
        if (mode === 'out-in') {
          setActiveSub(prevSub)
          return
        }
      } else {
        parent && remove(this.nodes, parent)
      }
    }

    let reusingDeferredAnchor = false
    if (isHydrating) {
      const isRevivingDeferredBranch =
        isInDeferredHydrationBoundary() &&
        !!render &&
        this.anchorLabel !== 'slot' &&
        !isValidBlock(this.nodes)

      reusingDeferredAnchor =
        isRevivingDeferredBranch && !!this.anchor && !!this.anchor.parentNode

      // Deferred hydration can keep an empty wrapper fragment alive, then resolve
      // it to a real branch before hydration exits. Re-point the cursor at the
      // fragment-owned insertion anchor so the late branch inserts before that
      // anchor instead of consuming trailing hydrated siblings or the enclosing
      // slot boundary.
      if (isRevivingDeferredBranch) {
        let slotEndAnchor: Node | null = null
        const anchor =
          this.anchor ||
          (currentHydrationNode === (slotEndAnchor = getCurrentSlotEndAnchor())
            ? slotEndAnchor
            : null)
        if (anchor) {
          setCurrentHydrationNode(markHydrationAnchor(anchor))
        }
      }
    }

    this.renderBranch(
      render,
      transition,
      parent,
      key,
      noScope,
      wasMounted || !!parent,
    )
    setActiveSub(prevSub)

    if (isHydrating && this.anchorLabel !== 'slot' && !reusingDeferredAnchor) {
      this.hydrate(render == null)
    }
  }

  renderBranch(
    render: BlockFn | undefined,
    transition: VaporTransitionHooks | undefined,
    parent: ParentNode | null,
    key: any,
    noScope: boolean = false,
    notifyUpdated: boolean = !!parent,
  ): void {
    this.current = key
    if (render) {
      const keepAliveCtx = isKeepAliveEnabled ? this.keepAliveCtx : null
      // A compiler-proven static branch can skip its own EffectScope, but attrs
      // fallthrough still registers branch-owned cleanup.
      const useScope = !noScope || !!this.hasFallthroughAttrs
      if (useScope) {
        // try to reuse the kept-alive scope
        const scope = keepAliveCtx && keepAliveCtx.getScope(this.current)
        if (scope) {
          this.scope = scope
        } else {
          this.scope = new EffectScope()
        }
      } else {
        this.scope = undefined
      }

      const renderBranch = () => {
        try {
          this.nodes = this.runWithRenderCtx(
            () =>
              (useScope ? this.scope!.run(render) : render()) || EMPTY_BLOCK,
            this.scope,
          )
        } finally {
          // propagate the fragment key onto freshly rendered nodes.
          const key = this.keyed ? this.current : this.$key
          // Only propagate branch keys when Transition or KeepAlive consumes them.
          if (
            key !== undefined &&
            (transition || this.inTransition || keepAliveCtx)
          ) {
            setBlockKey(this.nodes, key)
          }

          if (isTransitionEnabled && transition) {
            this.$transition = applyTransitionHooks(this.nodes, transition)
          }

          // call processShapeFlag to mark shapeFlag before mounting.
          // This must run before leaving the keyed cache-key context so
          // creating components inside the branch can still resolve the
          // same cache key during initial mount.
          if (keepAliveCtx) {
            keepAliveCtx.processShapeFlag(this.nodes)
          }
        }
      }

      if (keepAliveCtx && this.keyed) {
        withCurrentCacheKey(key, renderBranch)
      } else {
        renderBranch()
      }

      if (parent) {
        const onBeforeInsert = this.onBeforeInsert
        if (onBeforeInsert) {
          onBeforeInsert.forEach(hook => hook(this.nodes))
        }
        insert(this.nodes, parent, this.anchor)
      }
    } else {
      this.scope = undefined
      this.nodes = EMPTY_BLOCK
    }

    const onUpdated = this.onUpdated
    if (notifyUpdated && onUpdated) {
      onUpdated.forEach(hook => hook(this.nodes))
    }
  }

  // Keep this as a prototype method to avoid per-instance closure allocation.
  hydrate(isEmpty = false, isSlot = false): void {
    // early return allows tree-shaking of hydration logic when not used
    if (!isHydrating) return

    let advanceAfterRestore: Node | null = null
    let exitHydrationBoundary: (() => void) | undefined

    const reuseAnchor = (anchor: Node): void => {
      this.anchor = markHydrationAnchor(anchor)
      if (currentHydrationNode === this.anchor) {
        advanceHydrationNode(this.anchor)
      } else {
        exitHydrationBoundary = enterHydrationBoundary(this.anchor)
        advanceAfterRestore = this.anchor
      }
    }

    const createRuntimeAnchor = (): Node =>
      (this.anchor = markHydrationAnchor(
        __DEV__ ? createComment(this.anchorLabel!) : createTextNode(),
      ))

    const cleanupAndInsertRuntimeAnchor = (
      parentNode: Node,
      nextNode: Node | null,
      cleanupStart: Node,
      cleanupUntil: Node | null,
    ): void => {
      if (cleanupUntil) {
        exitHydrationBoundary = enterHydrationBoundary(cleanupUntil)
      } else {
        cleanupHydrationTail(cleanupStart)
        setCurrentHydrationNode(null)
      }
      queueAnchorInsert(parentNode, nextNode, createRuntimeAnchor)
    }

    try {
      // reuse `<!---->` as anchor
      // `<div v-if="false"></div>` -> `<!---->`
      if (isEmpty) {
        if (isComment(currentHydrationNode!, '')) {
          reuseAnchor(currentHydrationNode!)
          return
        }
        if (
          this.anchorLabel &&
          currentHydrationNode &&
          isComment(currentHydrationNode, 'teleport anchor')
        ) {
          const parentNode = getParentNode(currentHydrationNode)
          const anchor = markHydrationAnchor(currentHydrationNode)
          if (parentNode) {
            // Target-side teleport anchors are structural. Empty dynamic
            // fragments insert their own anchor before the target anchor
            // instead of consuming it as mismatched SSR content.
            queueAnchorInsert(parentNode, anchor, createRuntimeAnchor)
            return
          }
        }
        if (
          !isSlot &&
          this.anchorLabel &&
          currentHydrationNode &&
          !isHydratingSlotFallbackActive() &&
          !isComment(currentHydrationNode, ']')
        ) {
          const parentNode = getParentNode(currentHydrationNode)
          const anchor = nextLogicalSibling(currentHydrationNode)
          // Empty branch against non-empty SSR output has no block node to
          // derive an insertion point from, so use the current hydration range.
          const reusableAnchor =
            anchor &&
            anchor.nodeType === 8 &&
            isReusableDynamicFragmentAnchor(
              anchor as Comment,
              this.anchorLabel,
            ) &&
            getParentNode(anchor)
              ? anchor
              : null
          if (parentNode) {
            this.nodes = EMPTY_BLOCK
            if (reusableAnchor) {
              reuseAnchor(reusableAnchor)
            } else {
              cleanupAndInsertRuntimeAnchor(
                parentNode,
                anchor,
                currentHydrationNode,
                anchor,
              )
            }
            return
          }
        }
      }

      // Reuse an existing SSR comment anchor for empty dynamic-component /
      // async-component / keyed-fragment branches. Without this, hydration can
      // end up creating a detached runtime anchor and lose the parent/sibling
      // position needed for same-hydration branch flips.
      if (
        this.anchorLabel &&
        !isValidBlock(this.nodes) &&
        this.nodes instanceof Comment &&
        isReusableDynamicFragmentAnchor(this.nodes, this.anchorLabel) &&
        getParentNode(this.nodes)
      ) {
        const anchor = this.nodes
        this.nodes = EMPTY_BLOCK
        reuseAnchor(anchor)
        return
      }

      // Empty dynamic fragments can also start from a detached runtime comment
      // (for example client null against non-empty SSR content). In that case
      // derive the insertion point from the current hydration cursor rather
      // than from the detached block node, and let boundary cleanup trim the
      // SSR range before the next logical sibling.
      if (
        this.anchorLabel &&
        !isValidBlock(this.nodes) &&
        this.nodes instanceof Comment &&
        !getParentNode(this.nodes) &&
        currentHydrationNode
      ) {
        const parentNode = getParentNode(currentHydrationNode)
        const nextNode = nextLogicalSibling(currentHydrationNode)
        if (parentNode) {
          this.nodes = EMPTY_BLOCK
          cleanupAndInsertRuntimeAnchor(
            parentNode,
            nextNode,
            currentHydrationNode,
            nextNode,
          )
          return
        }
      }

      const currentSlotEndAnchor = getCurrentSlotEndAnchor()
      const forwardedSlot = isSlot
        ? (this as any as SlotFragment).forwarded
        : false
      const slotAnchor = isSlot ? currentSlotEndAnchor : null

      // Reuse SSR `<!--]-->` as anchor.
      // SSR wraps slots and multi-root `v-if` branches with `<!--[-->...<!--]-->`.
      // Non-forwarded slots always own the closing `<!--]-->`, even when empty.
      // Forwarded slots only own it when they rendered valid content.
      const closeOwner = getDynamicCloseOwner(
        isSlot,
        forwardedSlot,
        this.anchorLabel,
        this.nodes,
        currentSlotEndAnchor,
      )
      if (closeOwner === CloseAnchorOwner.Self) {
        const anchor = locateHydrationBoundaryClose(
          slotAnchor || currentHydrationNode!,
          slotAnchor || null,
        )
        if (isComment(anchor!, ']')) {
          reuseAnchor(anchor)
          return
        } else if (__DEV__) {
          throw new Error(
            `Failed to locate ${this.anchorLabel} fragment anchor. this is likely a Vue internal bug.`,
          )
        }
      } else if (
        closeOwner === CloseAnchorOwner.ParentAfter &&
        currentSlotEndAnchor
      ) {
        // Otherwise, create a new anchor.
        // This covers: empty forwarded slots.
        // Keep the forwarded slot close marker structural for parent cleanup,
        // even though this fragment uses a runtime anchor after it.
        const anchor = markHydrationAnchor(currentSlotEndAnchor)
        queueAnchorInsert(
          anchor.parentNode!,
          anchor.nextSibling,
          createRuntimeAnchor,
        )
        return
      } else if (
        closeOwner === CloseAnchorOwner.ParentBefore &&
        currentSlotEndAnchor
      ) {
        const endAnchor = currentSlotEndAnchor
        queuePostFlushCb(() => {
          const parentNode = getParentNode(endAnchor)
          if (!parentNode) return
          parentNode.insertBefore(createRuntimeAnchor(), endAnchor)
        })
        return
      }

      // Otherwise, create a new anchor.
      // This covers: dynamic-component, async component, keyed fragment.
      let parentNode: Node | null
      let nextNode: Node | null
      if (
        this.anchorLabel === 'if' &&
        !isValidBlock(this.nodes) &&
        currentSlotEndAnchor &&
        currentHydrationNode === currentSlotEndAnchor
      ) {
        // Only reuse the slot end anchor as insertion point when this empty
        // inner `v-if` has already consumed the whole local slot range.
        parentNode = currentSlotEndAnchor.parentNode
        nextNode = currentSlotEndAnchor
      } else {
        const node = findBlockNode(this.nodes)
        parentNode = node.parentNode
        nextNode = node.nextNode
      }
      queueAnchorInsert(parentNode!, nextNode, createRuntimeAnchor)
    } finally {
      exitHydrationBoundary && exitHydrationBoundary()
      if (advanceAfterRestore && currentHydrationNode === advanceAfterRestore) {
        advanceHydrationNode(advanceAfterRestore)
      }
    }
  }
}

export interface SlotBoundaryContext {
  parent: SlotBoundaryContext | null
  getFallback: () => BlockFn | undefined
  run<R>(fn: () => R, scope?: EffectScope): R
  markDirty: () => void
  redirected?: SlotBoundaryContext
}

let currentSlotBoundary: SlotBoundaryContext | null = null

export function getCurrentSlotBoundary(): SlotBoundaryContext | null {
  return currentSlotBoundary
}

export function setCurrentSlotBoundary(
  b: SlotBoundaryContext | null,
): SlotBoundaryContext | null {
  try {
    return currentSlotBoundary
  } finally {
    currentSlotBoundary = b
  }
}

export function withOwnedSlotBoundary<R>(
  boundary: SlotBoundaryContext | null,
  fn: () => R,
): R {
  const prev = setCurrentSlotBoundary(boundary)
  try {
    return fn()
  } finally {
    setCurrentSlotBoundary(prev)
  }
}

function getRedirectedBoundary(
  boundary: SlotBoundaryContext,
): SlotBoundaryContext {
  if (boundary.redirected) {
    return boundary.redirected
  }
  return (boundary.redirected = {
    get parent() {
      return boundary.parent
    },
    getFallback: () => undefined,
    run: (fn, scope) => boundary.run(fn, scope),
    markDirty: () => boundary.markDirty(),
  })
}

// Dynamic children (`v-if`, `v-for`, interop fragments) created under a slot
// boundary dirty the boundary on later updates.
export function trackSlotBoundaryDirtying(fragment: VaporFragment): void {
  const boundary = currentSlotBoundary
  if (!boundary) return
  ;(fragment.onUpdated ||= []).push(() => boundary.markDirty())
}

export function hasSlotFallback(
  boundary: SlotBoundaryContext | null | undefined,
): boolean {
  while (boundary) {
    if (boundary.getFallback()) {
      return true
    }
    boundary = boundary.parent
  }
  return false
}

function renderSlotFallback(
  boundary: SlotBoundaryContext | null,
  scope: EffectScope,
): Block | undefined {
  if (!boundary) {
    return undefined
  }

  const localFallback = boundary.getFallback()
  if (!localFallback) {
    return renderSlotFallback(boundary.parent, scope)
  }

  const renderFallback = () =>
    withOwnedSlotBoundary(getRedirectedBoundary(boundary), () =>
      localFallback(),
    )
  const local = boundary.run(() => scope.run(renderFallback) || [], scope)
  if (isValidBlock(local)) {
    return local
  }

  const inherited = renderSlotFallback(boundary.parent, scope)
  return inherited === undefined ? local : inherited
}

export interface SlotFallbackState {
  boundary: SlotBoundaryContext
  activeFallback: Block | null
  fallbackScope?: EffectScope
  lastNodesValid?: boolean
  pendingRecheck: boolean
  isRenderingFallback: boolean

  getContent(): Block
  getParentNode(): ParentNode | null
  getAnchor(): Node | null
  isBusy(): boolean
  isDisposed(): boolean
  isContentValid(): boolean
  syncNodes(): void
  notifyFallbackValidityChange(): void
}

function detachBlock(block: Block, parent: ParentNode): void {
  if (block instanceof Node) {
    if (block.parentNode === parent) {
      removeNode(block, parent)
    }
  } else if (isVaporComponent(block)) {
    if (block.block) {
      detachBlock(block.block, parent)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      detachBlock(block[i], parent)
    }
  } else {
    detachBlock(block.nodes, parent)
    if (
      !(block instanceof SlotFragment) &&
      block.anchor &&
      block.anchor.parentNode === parent
    ) {
      removeNode(block.anchor, parent)
    }
  }
}

export function markSlotFallbackDirty(state: SlotFallbackState): void {
  if (state.isDisposed()) {
    return
  }
  if (state.isRenderingFallback) {
    state.pendingRecheck = true
    return
  }
  if (state.isBusy()) {
    state.pendingRecheck = true
    return
  }
  recheckSlotFallback(state, true)
}

function clearSlotFallback(state: SlotFallbackState): void {
  const fallback = state.activeFallback
  if (fallback) {
    const parentNode = state.getParentNode()
    if (parentNode) {
      remove(fallback, parentNode)
    }
    state.activeFallback = null
  }
  if (state.fallbackScope) {
    state.fallbackScope.stop()
    state.fallbackScope = undefined
  }
}

function renderSlotFallbackState(
  state: SlotFallbackState,
): { block: Block; scope: EffectScope } | undefined {
  const scope = new EffectScope(true)
  let renderedFallback: Block | undefined
  state.isRenderingFallback = true
  try {
    renderedFallback = renderSlotFallback(state.boundary, scope)
  } catch (err) {
    scope.stop()
    throw err
  } finally {
    state.isRenderingFallback = false
  }

  if (!renderedFallback) {
    scope.stop()
    return undefined
  }

  return {
    block: renderedFallback,
    scope,
  }
}

export function insertActiveSlotFallback(state: SlotFallbackState): void {
  const fallback = state.activeFallback
  if (isHydrating || !fallback || !isValidBlock(fallback)) {
    return
  }
  const parentNode = state.getParentNode()
  if (!parentNode) {
    return
  }
  insert(fallback, parentNode, state.getAnchor())
}

function commitSlotFallback(
  state: SlotFallbackState,
  block: Block,
  scope: EffectScope,
  detachContent: boolean,
): void {
  const parentNode = state.getParentNode()
  if (detachContent && !isHydrating && parentNode) {
    detachBlock(state.getContent(), parentNode)
  }
  state.activeFallback = block
  state.fallbackScope = scope
  if (isTransitionEnabled) {
    const transitionState = state as SlotFallbackState & TransitionOptions
    if (transitionState.$transition) {
      // Match VDOM slot fallback branch identity so fallback enter does not
      // early-remove the currently leaving slot content.
      setBlockKey(block, '_fb')
      transitionState.$transition = applyTransitionHooks(
        block,
        transitionState.$transition,
      )
    }
  }
  insertActiveSlotFallback(state)
}

export function disposeSlotFallback(state: SlotFallbackState): void {
  clearSlotFallback(state)
  state.pendingRecheck = false
  state.lastNodesValid = undefined
}

export function recheckSlotFallback(
  state: SlotFallbackState,
  force: boolean = false,
): void {
  if (state.isRenderingFallback) {
    state.pendingRecheck = true
    return
  }

  const fallback = state.activeFallback
  const fallbackValid = fallback ? isValidBlock(fallback) : false
  const contentValid = state.isContentValid()
  const prevNodesValid =
    state.lastNodesValid === undefined
      ? fallback
        ? fallbackValid
        : contentValid
      : state.lastNodesValid
  if (!force && contentValid && !fallback && prevNodesValid) {
    state.syncNodes()
    state.lastNodesValid = true
    return
  }

  if (contentValid) {
    const content = state.getContent()
    const hadFallback = !!fallback
    clearSlotFallback(state)
    if (!isHydrating && hadFallback) {
      const parentNode = state.getParentNode()
      if (parentNode) {
        insert(content, parentNode, state.getAnchor())
      }
    }
  } else {
    if (
      fallback &&
      prevNodesValid &&
      !fallbackValid &&
      !hasSlotFallback(state.boundary.parent)
    ) {
      const parentNode = state.getParentNode()
      if (parentNode) {
        detachBlock(fallback, parentNode)
      }
    } else if (fallback && !prevNodesValid && fallbackValid) {
      insertActiveSlotFallback(state)
    } else if (force || !fallback) {
      const hadFallback = !!fallback
      const result = renderSlotFallbackState(state)
      clearSlotFallback(state)
      if (result) {
        commitSlotFallback(state, result.block, result.scope, !hadFallback)
        if (state.pendingRecheck) {
          state.pendingRecheck = false
          recheckSlotFallback(state, true)
        }
      }
    } else {
      insertActiveSlotFallback(state)
    }
  }

  const nextFallback = state.activeFallback
  const nextNodesValid = nextFallback
    ? isValidBlock(nextFallback)
    : state.isContentValid()
  state.syncNodes()
  state.lastNodesValid = nextNodesValid
  if (prevNodesValid !== nextNodesValid) {
    state.notifyFallbackValidityChange()
  }
}

interface HydratingSlotBoundaryState {
  endAnchor: Node | null
  fallbackActive: boolean
}

let currentHydratingSlotBoundaryState: HydratingSlotBoundaryState | null = null

function setCurrentHydratingSlotBoundaryState(
  state: HydratingSlotBoundaryState | null,
): HydratingSlotBoundaryState | null {
  try {
    return currentHydratingSlotBoundaryState
  } finally {
    currentHydratingSlotBoundaryState = state
  }
}

export function getCurrentSlotEndAnchor(): Node | null {
  return currentHydratingSlotBoundaryState
    ? currentHydratingSlotBoundaryState.endAnchor
    : null
}

export function withHydratingSlotBoundary<R>(fn: () => R): R {
  let endAnchor = getCurrentSlotEndAnchor()
  let exitHydrationBoundary: (() => void) | undefined

  locateHydrationNode()
  if (isComment(currentHydrationNode!, '[')) {
    endAnchor = locateEndAnchor(currentHydrationNode)
    setCurrentHydrationNode(currentHydrationNode.nextSibling)
    exitHydrationBoundary = enterHydrationBoundary(endAnchor)
  }
  const prevState = setCurrentHydratingSlotBoundaryState({
    endAnchor,
    fallbackActive: false,
  })

  try {
    return fn()
  } finally {
    setCurrentHydratingSlotBoundaryState(prevState)
    exitHydrationBoundary && exitHydrationBoundary()
  }
}

// Tracks hydration while a slot boundary is resolving fallback through inner
// empty control-flow fragments, e.g.
// - `<slot><template v-if="false" /></slot>`
// - `<slot><span v-for="item in items" /></slot>`.
// We need a boundary-level marker because the inner empty fragment can hydrate
// before slot render finishes deciding whether fallback will take over. While
// active, empty inner fragments should create their own runtime anchor instead
// of assuming SSR already provided the final insertion point.
export function isHydratingSlotFallbackActive(): boolean {
  return !!(
    currentHydratingSlotBoundaryState &&
    currentHydratingSlotBoundaryState.fallbackActive
  )
}

function setCurrentHydratingSlotFallbackActive(active: boolean): boolean {
  try {
    return isHydratingSlotFallbackActive()
  } finally {
    if (currentHydratingSlotBoundaryState) {
      currentHydratingSlotBoundaryState.fallbackActive = active
    }
  }
}

export function withHydratingSlotFallbackActive<R>(fn: () => R): R {
  const prevState = setCurrentHydratingSlotFallbackActive(true)
  try {
    return fn()
  } finally {
    setCurrentHydratingSlotFallbackActive(prevState)
  }
}

function isReusableDynamicFragmentAnchor(
  node: Comment,
  anchorLabel: string,
): boolean {
  return (
    isComment(node, anchorLabel) ||
    (isComment(node, '') &&
      (anchorLabel === 'dynamic-component' ||
        anchorLabel === 'async component' ||
        anchorLabel === 'keyed'))
  )
}

export class SlotFragment extends DynamicFragment implements SlotFallbackState {
  private disposed = false
  forwarded = false
  parentSlotBoundary: SlotBoundaryContext | null = getCurrentSlotBoundary()
  // Custom elements with `shadowRoot: false` replace their native slot outlet
  // after mount. Keep the live fallback block on the fragment so CE slot sync
  // can preserve block ownership after the outlet node is gone.
  customElementFallback?: Block
  activeFallback: Block | null = null
  fallbackScope?: EffectScope
  pendingRecheck = false
  isRenderingFallback = false
  private content: Block = EMPTY_BLOCK
  private localFallback?: BlockFn
  private isUpdatingSlot = false
  private _slotFallbackBoundary?: SlotBoundaryContext
  private notifyParent: boolean

  constructor(notifyParent: boolean = false) {
    super(isHydrating || __DEV__ ? 'slot' : undefined, false, false, false)
    this.notifyParent = notifyParent
    if (!isHydrating) {
      this.insert = (parent, anchor) => this.insertSlot(parent, anchor)
    }
    this.remove = parent => this.removeSlot(parent)
  }

  private ensureSlotFallbackBoundary(): SlotBoundaryContext {
    if (this._slotFallbackBoundary) {
      return this._slotFallbackBoundary
    }
    const owner = this
    return (this._slotFallbackBoundary = {
      get parent() {
        return owner.parentSlotBoundary
      },
      getFallback: () => this.localFallback,
      run: (fn, scope) => this.runWithRenderCtx(fn, scope),
      markDirty: () => markSlotFallbackDirty(this),
    })
  }

  get fallbackBlock(): Block | null {
    return this.activeFallback
  }

  get boundary(): SlotBoundaryContext {
    return this.slotFallbackBoundary
  }

  get slotFallbackBoundary(): SlotBoundaryContext {
    return this.ensureSlotFallbackBoundary()
  }

  private insertSlot(parent: ParentNode, anchor: Node | null): void {
    this.disposed = false
    insert(this.nodes, parent, anchor)
  }

  private removeSlot(parent?: ParentNode): void {
    this.disposed = true
    const nodes = this.nodes
    remove(nodes, parent)
    if (this.activeFallback === nodes) {
      this.activeFallback = null
    }
    disposeSlotFallback(this)
  }

  private updateContent(render: BlockFn | undefined, key: any): void {
    this.nodes = this.content
    // When fallback is active, recompute content without inserting it. The
    // content may still be invalid, so recheckSlotFallback decides whether it
    // can return to the DOM.
    this.update(render, key, false, !this.activeFallback)
    this.content = this.nodes
    this.nodes = this.activeFallback || this.content
  }

  updateSlot(
    render?: BlockFn,
    fallback?: BlockFn,
    key: any = render || fallback,
  ): void {
    const prevLocalFallback = this.localFallback
    this.localFallback = fallback
    const fallbackChanged = prevLocalFallback !== fallback
    const fastSlotKey = key === undefined ? render : key

    if (
      !isHydrating &&
      !fallback &&
      !this.parentSlotBoundary &&
      !this._slotFallbackBoundary
    ) {
      this.update(render, fastSlotKey)
      this.content = this.nodes
      return
    }

    const boundary = this.slotFallbackBoundary
    const slotRender = render
      ? () => withOwnedSlotBoundary(boundary, render)
      : () => []
    const slotKey = key === undefined ? slotRender : key
    this.isUpdatingSlot = true
    this.pendingRecheck = false

    try {
      const shouldForce = fallbackChanged
      if (isHydrating) {
        withHydratingSlotBoundary(() => {
          const prev = isHydratingSlotFallbackActive()
          try {
            if (hasSlotFallback(boundary)) {
              setCurrentHydratingSlotFallbackActive(true)
            }
            this.updateContent(slotRender, slotKey)
            const contentValid = isValidBlock(this.content)
            recheckSlotFallback(this, shouldForce)
            // Updates run under the temporary fallback-active marker so empty
            // inner branches can materialize their own anchors if fallback
            // takes over. If recheck resolves back to content, restore the
            // outer state before hydrate(); the surrounding finally still
            // restores nested callers when we leave this boundary.
            if (!hasSlotFallback(boundary) || contentValid) {
              setCurrentHydratingSlotFallbackActive(prev)
            }
            this.hydrate(!isValidBlock(this.nodes), true)
          } finally {
            setCurrentHydratingSlotFallbackActive(prev)
          }
        })
      } else {
        this.updateContent(slotRender, slotKey)
        recheckSlotFallback(this, shouldForce)
      }
    } finally {
      this.pendingRecheck = false
      this.isUpdatingSlot = false
    }
  }

  getContent(): Block {
    return this.content
  }

  getParentNode(): ParentNode | null {
    return this.anchor ? this.anchor.parentNode : null
  }

  getAnchor(): Node | null {
    return this.anchor || null
  }

  isBusy(): boolean {
    return this.isUpdatingSlot
  }

  isDisposed(): boolean {
    return this.disposed
  }

  isContentValid(): boolean {
    return isValidBlock(this.content)
  }

  syncNodes(): void {
    this.nodes = this.activeFallback || this.content
  }

  notifyFallbackValidityChange(): void {
    if (this.notifyParent && this.parentSlotBoundary) {
      this.parentSlotBoundary.markDirty()
    }
  }
}

export function isFragment(val: NonNullable<unknown>): val is VaporFragment {
  return val instanceof VaporFragment
}

export function isDynamicFragment(
  val: NonNullable<unknown>,
): val is DynamicFragment {
  return val instanceof DynamicFragment
}
