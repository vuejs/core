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
  // Interop fragments can be visible to outer slot boundaries before their
  // initial output has settled, both during hydration and during the first
  // non-hydrating render pass. Treat them as valid until that resolution
  // finishes so parents do not eagerly activate fallback against a child whose
  // final block has not been determined yet.
  validityPending?: boolean
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
    const prevSlotOwner = setCurrentSlotOwner(this.slotOwner)
    let prevKeepAliveCtx: VaporKeepAliveContext | null = null
    if (isKeepAliveEnabled) {
      prevKeepAliveCtx = setCurrentKeepAliveCtx(this.keepAliveCtx || null)
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

  constructor(nodes: Block[]) {
    super(nodes)
    trackSlotBoundaryDirtying(this)
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
    trackSlotBoundary: boolean = true,
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

  update(render?: BlockFn, key: any = render, noScope: boolean = false): void {
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
    const parent = isHydrating ? null : this.anchor.parentNode
    // teardown previous branch
    if (this.current !== undefined) {
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
              )
            } else {
              this.renderBranch(render, transition, parent, key, noScope)
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

    const isRevivingDeferredBranch =
      isHydrating &&
      isInDeferredHydrationBoundary() &&
      !!render &&
      this.anchorLabel !== 'slot' &&
      !isValidBlock(this.nodes)

    const reusingDeferredAnchor =
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

    this.renderBranch(render, transition, parent, key, noScope)
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

    if (parent) {
      const onUpdated = this.onUpdated
      if (onUpdated) {
        onUpdated.forEach(hook => hook(this.nodes))
      }
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
  ;(fragment.onUpdated || (fragment.onUpdated = [])).push(() =>
    boundary.markDirty(),
  )
}

function walkSlotFallbackBlock(
  block: Block,
  node: (node: Node) => boolean,
  fragment: (block: VaporFragment, walk: (block: Block) => boolean) => boolean,
): boolean {
  if (block instanceof Node) {
    return node(block)
  }

  if (isVaporComponent(block)) {
    return walkSlotFallbackBlock(block.block, node, fragment)
  }

  if (isArray(block)) {
    for (const child of block) {
      if (walkSlotFallbackBlock(child, node, fragment)) {
        return true
      }
    }
    return false
  }

  return fragment(block, block => walkSlotFallbackBlock(block, node, fragment))
}

// Slot fallback preservation is keyed off the fragment owner, even though
// carrier relocation / ordering still operates on the full Block wrapper.
export function resolveSlotFallbackCarrierOwner(
  block: Block,
): VaporFragment | null {
  let owner: VaporFragment | null = null
  walkSlotFallbackBlock(
    block,
    () => false,
    block => {
      owner = block
      return true
    },
  )
  return owner
}

export function findFirstSlotFallbackCarrierNode(block: Block): Node | null {
  let node: Node | null = null
  walkSlotFallbackBlock(
    block,
    value => {
      node = value
      return true
    },
    (block, walk) => {
      if (walk(block.nodes)) {
        return true
      }
      if (block.anchor) {
        node = block.anchor
        return true
      }
      return false
    },
  )
  return node
}

function collectBlockNodes(
  block: Block,
  nodes: Node[] = [],
  includeComments: boolean = false,
): Node[] {
  walkSlotFallbackBlock(
    block,
    block => {
      if (includeComments || !(block instanceof Comment)) {
        nodes.push(block)
      }
      return false
    },
    block => {
      collectBlockNodes(block.nodes, nodes, true)
      if (block.anchor) {
        nodes.push(block.anchor)
      }
      return false
    },
  )
  return nodes
}

export function mutateSlotFallbackCarrier(
  block: Block,
  apply: (block: Node | VaporFragment) => void,
): void {
  walkSlotFallbackBlock(
    block,
    block => {
      if (!(block instanceof Comment)) {
        apply(block)
      }
      return false
    },
    block => {
      apply(block)
      return false
    },
  )
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

export function renderSlotFallback(
  boundary: SlotBoundaryContext | null | undefined,
  scope?: EffectScope,
  ...args: any[]
): Block | undefined {
  const [block, hasFallback] = renderSlotFallbackBlock(
    boundary || null,
    scope,
    args,
  )
  return hasFallback ? block : undefined
}

function renderSlotFallbackBlock(
  boundary: SlotBoundaryContext | null,
  scope: EffectScope | undefined,
  args: any[],
): [Block, boolean] {
  if (!boundary) {
    return [[], false]
  }

  const localFallback = boundary.getFallback()
  if (!localFallback) {
    return renderSlotFallbackBlock(boundary.parent, scope, args)
  }

  const renderFallback = () =>
    withOwnedSlotBoundary(getRedirectedBoundary(boundary), () =>
      localFallback(...args),
    )
  const local = boundary.run(
    () => (scope ? scope.run(renderFallback) : renderFallback()) || [],
    scope,
  )
  if (isValidBlock(local)) {
    return [local, true]
  }

  const [inherited] = renderSlotFallbackBlock(boundary.parent, scope, args)
  return [
    resolveSlotFallbackCarrierOwner(local) ? [inherited, local] : inherited,
    true,
  ]
}

export interface SlotFallbackOutlet {
  boundary: SlotBoundaryContext
  activeFallback: Block | null
  fallbackScope?: EffectScope
  lastEffectiveValid?: boolean
  pendingRecheck: boolean
  isRenderingFallback: boolean
  rerunRecheckAfterFallbackRender?: boolean

  getContent(): Block
  getParentNode(): ParentNode | null
  getAnchor(): Node | null
  isBusy?(): boolean
  isDisposed?(): boolean
  isContentValid?(): boolean
  syncEffectiveOutput?(): void
  notifyFallbackValidityChange(): void
}

type SlotFallbackResult =
  | {
      found: true
      block: Block
      scope: EffectScope
    }
  | {
      found: false
    }

export function getSlotEffectiveOutput(outlet: SlotFallbackOutlet): Block {
  return outlet.activeFallback || outlet.getContent()
}

function isSlotFallbackContentValid(outlet: SlotFallbackOutlet): boolean {
  return outlet.isContentValid
    ? outlet.isContentValid()
    : isValidBlock(outlet.getContent())
}

export function markSlotFallbackDirty(outlet: SlotFallbackOutlet): void {
  if (outlet.isDisposed && outlet.isDisposed()) {
    return
  }
  if (outlet.isRenderingFallback) {
    if (isHydrating) {
      outlet.pendingRecheck = true
    }
    return
  }
  if (outlet.isBusy && outlet.isBusy()) {
    outlet.pendingRecheck = true
    return
  }
  recheckSlotFallback(outlet, true)
}

function clearSlotFallback(outlet: SlotFallbackOutlet): void {
  if (outlet.activeFallback) {
    const parentNode = outlet.getParentNode()
    if (parentNode) {
      remove(outlet.activeFallback, parentNode)
    }
    outlet.activeFallback = null
  }
  if (outlet.fallbackScope) {
    outlet.fallbackScope.stop()
    outlet.fallbackScope = undefined
  }
}

function renderSlotFallbackForOutlet(
  outlet: SlotFallbackOutlet,
): SlotFallbackResult {
  const scope = new EffectScope()
  let renderedFallback: Block | undefined
  outlet.isRenderingFallback = true
  try {
    renderedFallback = renderSlotFallback(outlet.boundary, scope) || undefined
  } catch (err) {
    scope.stop()
    throw err
  } finally {
    outlet.isRenderingFallback = false
  }

  if (!renderedFallback) {
    scope.stop()
    return { found: false }
  }

  return {
    found: true,
    block: renderedFallback,
    scope,
  }
}

function syncSlotFallbackOrder(outlet: SlotFallbackOutlet, block: Block): void {
  if (!isFragment(block) || !isArray(block.nodes) || block.nodes.length < 2) {
    return
  }

  const carrierNodes = collectBlockNodes(outlet.getContent(), [], true)
  const fallbackNodes = collectBlockNodes(block, [], true)
  const lastNode = fallbackNodes[fallbackNodes.length - 1]
  if (!carrierNodes.length || !lastNode) {
    return
  }

  const parentNode = carrierNodes[0].parentNode
  if (!parentNode || lastNode.parentNode !== parentNode) {
    return
  }

  let inOrder = true
  let nextNode = lastNode.nextSibling
  for (const carrierNode of carrierNodes) {
    if (carrierNode.parentNode !== parentNode) {
      return
    }
    if (carrierNode !== nextNode) {
      inOrder = false
      break
    }
    nextNode = carrierNode.nextSibling
  }

  if (inOrder) {
    return
  }

  let anchor = lastNode.nextSibling
  for (let i = carrierNodes.length - 1; i >= 0; i--) {
    const carrierNode = carrierNodes[i]
    parentNode.insertBefore(carrierNode, anchor)
    anchor = carrierNode as ChildNode
  }
}

function ensureSlotFallbackOrderHook(
  outlet: SlotFallbackOutlet,
  block: Block,
): void {
  if (!isFragment(block)) {
    return
  }

  const fragment = block as VaporFragment<Block> & {
    hasSlotFallbackOrderHook?: boolean
  }
  if (fragment.hasSlotFallbackOrderHook) {
    return
  }

  ;(fragment.onUpdated || (fragment.onUpdated = [])).push(() =>
    syncSlotFallbackOrder(outlet, fragment),
  )
  fragment.hasSlotFallbackOrderHook = true
}

export function insertActiveSlotFallback(outlet: SlotFallbackOutlet): void {
  if (isHydrating || !outlet.activeFallback) {
    return
  }
  const parentNode = outlet.getParentNode()
  if (!parentNode) {
    return
  }
  const carrierAnchor = findFirstSlotFallbackCarrierNode(outlet.getContent())
  insert(
    outlet.activeFallback,
    parentNode,
    carrierAnchor && carrierAnchor.parentNode === parentNode
      ? carrierAnchor
      : outlet.getAnchor(),
  )
}

function commitSlotFallback(
  outlet: SlotFallbackOutlet,
  block: Block,
  scope: EffectScope,
): void {
  outlet.activeFallback = block
  outlet.fallbackScope = scope
  ensureSlotFallbackOrderHook(outlet, block)
  if (isTransitionEnabled) {
    const transitionOutlet = outlet as SlotFallbackOutlet & TransitionOptions
    if (transitionOutlet.$transition) {
      // Match VDOM slot fallback branch identity so fallback enter does not
      // early-remove the currently leaving slot content.
      setBlockKey(block, '_fb')
      transitionOutlet.$transition = applyTransitionHooks(
        block,
        transitionOutlet.$transition,
      )
    }
  }
  insertActiveSlotFallback(outlet)
}

export function syncActiveSlotFallback(outlet: SlotFallbackOutlet): void {
  if (!outlet.activeFallback) {
    return
  }
  const activeFallback = outlet.activeFallback
  queuePostFlushCb(() => {
    syncSlotFallbackOrder(outlet, activeFallback)
  })
}

export function disposeSlotFallback(outlet: SlotFallbackOutlet): void {
  clearSlotFallback(outlet)
  outlet.pendingRecheck = false
  outlet.lastEffectiveValid = undefined
}

export function recheckSlotFallback(
  outlet: SlotFallbackOutlet,
  force: boolean = false,
): void {
  if (outlet.isRenderingFallback) {
    outlet.pendingRecheck = true
    return
  }

  const prevValid =
    outlet.lastEffectiveValid === undefined
      ? outlet.activeFallback
        ? isValidBlock(outlet.activeFallback)
        : isSlotFallbackContentValid(outlet)
      : outlet.lastEffectiveValid
  const contentValid = isSlotFallbackContentValid(outlet)

  if (contentValid) {
    clearSlotFallback(outlet)
  } else {
    if (force) {
      clearSlotFallback(outlet)
    }
    if (outlet.activeFallback) {
      insertActiveSlotFallback(outlet)
    } else {
      const result = renderSlotFallbackForOutlet(outlet)
      if (result.found) {
        commitSlotFallback(outlet, result.block, result.scope)
        if (
          outlet.pendingRecheck &&
          outlet.rerunRecheckAfterFallbackRender !== false
        ) {
          outlet.pendingRecheck = false
          recheckSlotFallback(outlet, true)
        }
      } else {
        clearSlotFallback(outlet)
      }
    }
  }

  const nextValid = outlet.activeFallback
    ? isValidBlock(outlet.activeFallback)
    : isSlotFallbackContentValid(outlet)
  if (outlet.syncEffectiveOutput) {
    outlet.syncEffectiveOutput()
  }
  outlet.lastEffectiveValid = nextValid
  if (prevValid !== nextValid) {
    outlet.notifyFallbackValidityChange()
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

export class SlotFragment
  extends DynamicFragment
  implements SlotFallbackOutlet
{
  private disposed = false
  forwarded = false
  parentSlotBoundary: SlotBoundaryContext | null = getCurrentSlotBoundary()
  // Custom elements with `shadowRoot: false` replace their native slot outlet
  // after mount. Keep the live fallback owner on the fragment so CE slot sync
  // can preserve block ownership after the outlet node is gone.
  customElementFallback?: Block
  activeFallback: Block | null = null
  fallbackScope?: EffectScope
  pendingRecheck = false
  isRenderingFallback = false
  readonly rerunRecheckAfterFallbackRender = false
  private localFallback?: BlockFn
  private isUpdatingSlot = false
  private _slotFallbackBoundary?: SlotBoundaryContext

  constructor() {
    super(isHydrating || __DEV__ ? 'slot' : undefined, false, false, false)
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

  getEffectiveOutput(): Block {
    return getSlotEffectiveOutput(this)
  }

  private insertSlot(parent: ParentNode, anchor: Node | null): void {
    this.disposed = false
    if (this.fallbackBlock) {
      insert(this.fallbackBlock, parent, anchor)
      mutateSlotFallbackCarrier(this.nodes, block =>
        insert(block, parent, anchor),
      )
      return
    }
    insert(this.nodes, parent, anchor)
  }

  private removeSlot(parent?: ParentNode): void {
    this.disposed = true
    if (this.fallbackBlock) {
      mutateSlotFallbackCarrier(this.nodes, block => remove(block, parent))
    } else {
      remove(this.nodes, parent)
    }
    disposeSlotFallback(this)
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
            this.update(slotRender, slotKey)
            const contentValid = isValidBlock(this.nodes)
            recheckSlotFallback(this, shouldForce)
            // Updates run under the temporary fallback-active marker so empty
            // inner branches can materialize their own anchors if fallback
            // takes over. If recheck resolves back to content, restore the
            // outer state before hydrate(); the surrounding finally still
            // restores nested callers when we leave this boundary.
            if (!hasSlotFallback(boundary) || contentValid) {
              setCurrentHydratingSlotFallbackActive(prev)
            }
            this.hydrate(!isValidBlock(this.getEffectiveOutput()), true)
          } finally {
            setCurrentHydratingSlotFallbackActive(prev)
          }
        })
      } else {
        this.update(slotRender, slotKey)
        recheckSlotFallback(this, shouldForce)
      }
    } finally {
      this.pendingRecheck = false
      this.isUpdatingSlot = false
    }
  }

  getContent(): Block {
    return this.nodes
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

  notifyFallbackValidityChange(): void {
    if (this.parentSlotBoundary) {
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
