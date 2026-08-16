import { EffectScope, type ShallowRef, setActiveSub } from '@vue/reactivity'
import { createComment, createTextNode } from './dom/node'
import {
  type Block,
  type BlockFn,
  EMPTY_BLOCK,
  type TransitionOptions,
  type VaporTransitionHooks,
  insert,
  isValidBlock,
  isValidSlot,
  move,
  remove,
  removeAttachedNodes,
  removeNode,
} from './block'
import {
  type GenericComponentInstance,
  type MoveType,
  type SuspenseBoundary,
  type TransitionHooks,
  type VNode,
  currentInstance,
  queuePostFlushCb,
  restoreCurrentInstance,
  setCurrentInstance,
} from '@vue/runtime-dom'
import type { VaporComponentInstance } from './component'
import type { NodeRef } from './apiTemplateRef'
import {
  advanceHydrationNode,
  currentHydrationNode,
  isComment,
  isHydrating,
  locateEndAnchor,
  locateHydrationNode,
  markHydrationAnchor,
} from './dom/hydration'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots'
import {
  type SlotBoundaryContext,
  currentSlotBoundary,
  hasSlotFallback,
  registerContentInvalid,
  setCurrentSlotBoundary,
  trackSlotBoundaryDirtying,
  withSlotBoundary,
} from './slotBoundary'
import {
  getCurrentSlotEndAnchor,
  hydrateDynamicFragmentAnchor,
  prepareDeferredHydrationAnchor,
  queuePendingSlotContentAnchor,
  startPendingSlotContent,
  withHydratingSlotBoundary,
} from './dom/hydrateFragment'
import {
  type SlotResolutionState,
  disposeSlotResolution,
  invalidateExposedSlotContent,
  markSlotResolutionDirty,
  recheckSlotResolution,
} from './slotFragment'
import { setBlockKey } from './helpers/setKey'
import {
  type VaporKeepAliveContext,
  getKeepAliveContext,
  isKeepAliveEnabled,
} from './keepAlive'
import {
  applyTransitionHooks,
  deferBranchUpdateDuringLeave,
  isTransitionEnabled,
  isVaporTransition,
  removeBranchWithLeave,
} from './transition'
import {
  DYNAMIC,
  FOR,
  FOR_ITEM,
  FRAGMENT,
  SLOT,
  SLOT_FRAGMENT,
  VDOM,
} from './fragmentFlags'

export class VaporFragment<
  T extends Block = Block,
> implements TransitionOptions {
  /**
   * @internal fragment protocol flags. Role checks use a shared field instead
   * of class references so unused fragment implementations remain tree-shakable.
   */
  readonly __vf: number
  $key?: any
  $transition?: VaporTransitionHooks | undefined
  nodes: T
  vnode?: VNode | null
  anchor?: Node
  isBlockValid?: (componentAsValid?: boolean) => boolean
  insert?: (
    parent: ParentNode,
    anchor: Node | null,
    parentSuspense?: SuspenseBoundary | null,
    transitionHooks?: TransitionHooks,
    moveType?: MoveType,
  ) => void
  remove?: (parent?: ParentNode, transitionHooks?: TransitionHooks) => void
  hydrate?(...args: any[]): void

  applyScopeId?: (this: VaporFragment, block: Block) => void
  scopeOwner?: VaporComponentInstance
  slottedScopeId?: VaporComponentInstance['scopeId']
  // Optional protocol member: a block the fragment currently holds outside
  // `nodes` that scope id application must still reach (see SlotFragment).
  parkedContent?(): Block | undefined

  setRef?: (
    instance: VaporComponentInstance,
    ref: NodeRef,
    refFor: boolean,
    refKey: string | undefined,
  ) => void

  // hooks
  onBeforeInsert?: ((nodes: Block) => void)[]
  onRemove?: (() => void)[]
  onBeforeUpdate?: (() => void)[]
  onUpdated?: ((nodes?: Block) => void)[]

  constructor(nodes: T, flags: number = FRAGMENT) {
    this.nodes = nodes
    this.__vf = flags
  }
}

// Fragments whose content can (re-)render after the original synchronous
// render window — branch switches, deferred teleport children, interop slot
// re-renders — capture the ambient render context at construction so the
// deferred render can restore it. Fragments that only hold externally
// rendered content (ForFragment / ForBlock) stay on the lean base class:
// the for pipeline restores its ambient context through closures instead,
// once per v-for rather than once per item.
export class RenderContextFragment<
  T extends Block = Block,
> extends VaporFragment<T> {
  // render context
  readonly renderInstance: GenericComponentInstance | null = currentInstance
  readonly slotOwner: VaporComponentInstance | null = currentSlotOwner
  readonly keepAliveCtx?: VaporKeepAliveContext | null
  readonly slotBoundary: SlotBoundaryContext | null = currentSlotBoundary

  constructor(nodes: T, flags: number = FRAGMENT) {
    super(nodes, flags)
    if (isKeepAliveEnabled) {
      this.keepAliveCtx = getKeepAliveContext(currentInstance)
    }
  }

  protected runWithRenderCtx<R>(fn: () => R, scope?: EffectScope): R {
    return runWithRenderCtx(this, fn, scope)
  }
}

export function runWithRenderCtx<R>(
  fragment: RenderContextFragment,
  fn: () => R,
  scope?: EffectScope,
): R {
  const prevInstance = setCurrentInstance(fragment.renderInstance, scope)
  try {
    return runWithFragmentCtxOnly(fragment, fn)
  } finally {
    restoreCurrentInstance(prevInstance)
  }
}

// Restores fragment-owned ambient state only. The caller must already have the
// correct currentInstance / currentScope; use runWithRenderCtx for late renders.
export function runWithFragmentCtxOnly<R>(
  fragment: RenderContextFragment,
  fn: () => R,
): R {
  // When ambient fragment context already matches, no ambient state needs
  // restoring. This keeps ordinary branch renders on the cheap path.
  if (
    currentSlotOwner === fragment.slotOwner &&
    currentSlotBoundary === fragment.slotBoundary
  ) {
    return fn()
  }

  const prevSlotOwner = setCurrentSlotOwner(fragment.slotOwner)
  const prevBoundary = setCurrentSlotBoundary(fragment.slotBoundary)
  try {
    return fn()
  } finally {
    setCurrentSlotBoundary(prevBoundary)
    setCurrentSlotOwner(prevSlotOwner)
  }
}

export class ForFragment extends VaporFragment<Block[]> {
  // Listeners fired when the v-for resets its items in one shot
  // (whole-list clear or full remount). Selectors hook in here via
  // `frag.onReset(selector.reset)` so they can drop their internal state in
  // O(1) instead of N per-item Map.delete calls.
  resetListeners?: (() => void)[]

  constructor(
    nodes: Block[],
    trackSlotBoundary: boolean,
    onInvalid?: () => void,
  ) {
    super(nodes, FOR)
    if (trackSlotBoundary) trackSlotBoundaryDirtying(this, onInvalid)
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
    super(nodes, FOR_ITEM)
    this.scope = scope
    this.itemRef = item
    this.keyRef = key
    this.indexRef = index
    this.key = renderKey
  }
}

export class DynamicFragment extends RenderContextFragment {
  // @ts-expect-error - assigned in the constructor or hydrateDynamicFragmentAnchor()
  anchor: Node
  scope: EffectScope | undefined
  current?: BlockFn
  // Owned by the Transition module (deferBranchUpdateDuringLeave /
  // removeBranchWithLeave); the core update pipeline never touches it.
  pending?: { render?: BlockFn; key: any; noScope: boolean }
  anchorLabel?: string
  keyed?: boolean
  // Marks the generic dynamic fragment that createPlainElement creates for the
  // default-slot children of a dynamic element resolved to a native tag
  // (`rawSlots.$`). Unlike labeled control-flow fragments it has no
  // SSR-provided anchor, so hydration injects and then reuses its own runtime
  // anchor. Hydration logic must branch on this marker, never on
  // `anchorLabel === ''` — the empty string is only this fragment's (empty)
  // dev-mode comment text and must not double as a category signal.
  nativeChildren?: boolean
  inTransition?: boolean
  // Fallthrough attrs hooks register branch-owned effects on insert.
  hasFallthroughAttrs?: true
  // Whether update() ran before. The very first update renders as part of
  // the mount and must not fire onUpdated hooks; with an adopted template
  // anchor `parent` is non-null even then, so mount status can no longer be
  // inferred from the anchor being detached.
  everUpdated = false
  constructor(
    anchorLabel?: string,
    keyed: boolean = false,
    locate: boolean = true,
    trackSlotBoundary: boolean = false,
    onInvalid?: () => void,
    adoptAnchor?: Node,
    flags: number = DYNAMIC,
  ) {
    super(EMPTY_BLOCK, flags)
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
      this.anchor = resolveFragmentAnchor(adoptAnchor, anchorLabel)
      if (__DEV__) this.anchorLabel = anchorLabel
    }
    if (trackSlotBoundary) trackSlotBoundaryDirtying(this, onInvalid)
  }

  // Whether update() claims the SSR anchor itself during hydration.
  // SlotFragment opts out: updateSlot owns its hydration timing.
  protected get autoHydrate(): boolean {
    return true
  }

  update(render?: BlockFn, key: any = render, noScope: boolean = false): void {
    const everUpdated = this.everUpdated
    this.everUpdated = true
    if (key === this.current) {
      // On initial hydration, `key === current` means `render` is empty,
      // so this fragment hydrates as empty content.
      if (isHydrating && this.autoHydrate) {
        hydrateDynamicFragmentAnchor(this, true)
      }
      return
    }

    const transition = isTransitionEnabled ? this.$transition : undefined
    const wasMounted = this.current !== undefined
    if (wasMounted) {
      const onBeforeUpdate = this.onBeforeUpdate
      if (onBeforeUpdate) {
        for (let i = 0; i < onBeforeUpdate.length; i++) {
          onBeforeUpdate[i]()
        }
      }
    }
    // currently leaving: defer mounting the next branch until
    // the leave finishes.
    if (
      transition &&
      deferBranchUpdateDuringLeave(this, render, key, noScope)
    ) {
      return
    }

    const prevSub = setActiveSub()
    const parent = !isHydrating ? this.getBranchParent() : null
    let removePrevious: (() => void) | undefined
    // teardown previous branch
    if (wasMounted) {
      const scope = this.scope
      const previous = this.nodes
      const removeBranch = () => remove(previous, parent || undefined)
      let deferRemoval = false
      if (scope) {
        if (this.keepAliveCtx) {
          deferRemoval = this.keepAliveCtx.prepareBranchRemoval(this, scope)
        } else {
          scope.stop()
        }
      }
      if (
        transition &&
        removeBranchWithLeave(this, transition, parent, render, key, noScope)
      ) {
        // out-in: the next branch mounts after the leave finishes.
        setActiveSub(prevSub)
        return
      }
      if (deferRemoval) {
        removePrevious = removeBranch
      } else {
        removeBranch()
      }
    }

    const reusingDeferredAnchor = isHydrating
      ? prepareDeferredHydrationAnchor(this, !!render)
      : false

    this.renderBranch(
      render,
      transition,
      parent,
      key,
      noScope,
      // notify on any update except the mount-time first render; see the
      // `everUpdated` field comment
      wasMounted || (everUpdated && !!parent),
      removePrevious,
    )
    setActiveSub(prevSub)

    if (isHydrating && this.autoHydrate && !reusingDeferredAnchor) {
      hydrateDynamicFragmentAnchor(this, render == null)
    }
  }

  // Where update() removes the previous branch from and inserts the next one
  // into. Returning null keeps the branch out of the DOM.
  protected getBranchParent(): ParentNode | null {
    return this.anchor.parentNode
  }

  renderBranch(
    render: BlockFn | undefined,
    transition: VaporTransitionHooks | undefined,
    parent: ParentNode | null,
    key: any,
    noScope: boolean,
    notifyUpdated: boolean,
    removePrevious?: () => void,
  ): void {
    this.current = key
    if (render) {
      const keepAliveCtx = isKeepAliveEnabled ? this.keepAliveCtx : null
      // A compiler-proven static branch can skip its own EffectScope, but attrs
      // fallthrough still registers branch-owned cleanup.
      const useScope = !noScope || !!this.hasFallthroughAttrs
      if (!keepAliveCtx) {
        this.scope = useScope ? new EffectScope() : undefined
      }

      const renderBranch = () => {
        try {
          this.nodes = this.runWithRenderCtx(
            () =>
              (useScope ? this.scope!.run(render) : render()) || EMPTY_BLOCK,
            this.scope,
          )
        } finally {
          // Inherit the fragment key without overriding a child's own key.
          const key = this.keyed ? this.current : this.$key
          // Only propagate branch keys when Transition or KeepAlive consumes them.
          if (
            key !== undefined &&
            (transition || this.inTransition || keepAliveCtx)
          ) {
            setBlockKey(this.nodes, key, false)
          }

          if (isTransitionEnabled && transition) {
            this.$transition = applyTransitionHooks(this.nodes, transition)
          }
        }
      }

      keepAliveCtx
        ? keepAliveCtx.runBranchRender(
            this,
            renderBranch,
            useScope,
            removePrevious,
          )
        : renderBranch()

      if (this.applyScopeId) this.applyScopeId(this.nodes)
      if (parent) {
        const onBeforeInsert = this.onBeforeInsert
        if (onBeforeInsert) {
          onBeforeInsert.forEach(hook => hook(this.nodes))
        }
        insert(this.nodes, parent, this.anchor)
        if (removePrevious && keepAliveCtx) {
          // Publish the new cache entry only after it has been mounted.
          keepAliveCtx.cacheBlock(this)
        }
      }
    } else {
      this.scope = undefined
      this.nodes = EMPTY_BLOCK
      if (removePrevious) removePrevious()
    }

    const onUpdated = this.onUpdated
    if (notifyUpdated && onUpdated) {
      onUpdated.forEach(hook => hook(this.nodes))
    }
  }
}

// SlotFragment must live in the same module as DynamicFragment: `extends`
// reads the base class binding at module evaluation time, and fragment.ts
// sits inside a module cycle, so hoisting the class into another module can
// hit the base class before it is initialized depending on entry order.
export class SlotFragment
  extends DynamicFragment
  implements SlotResolutionState
{
  private disposed = false
  // Custom elements with `shadowRoot: false` replace their native slot outlet
  // after mount. Keep the live fallback block on the fragment so CE slot sync
  // can preserve block ownership after the outlet node is gone.
  customElementFallback?: Block
  activeFallback: Block | null = null
  fallbackInserted = false
  fallbackScope?: EffectScope
  lastNodesValid?: boolean
  pendingRecheck = false
  pendingRecheckForce = false
  isReconciling = false
  private readonly onContentInvalid: (() => void)[] = []
  private content: Block = EMPTY_BLOCK
  private localFallback?: BlockFn
  private isUpdating = false
  private ownBoundary?: SlotBoundaryContext
  // Slot-root outlets expose their content validity to the enclosing boundary.
  constructor(
    private readonly notifyParentBoundary: boolean = false,
    private readonly sharedFallback: boolean = false,
    private readonly inheritFallback: boolean = false,
    adoptAnchor?: Node,
  ) {
    super(
      isHydrating || __DEV__ ? 'slot' : undefined,
      false,
      false,
      false,
      undefined,
      adoptAnchor,
      SLOT_FRAGMENT,
    )
    if (sharedFallback) {
      if (this.slotBoundary) {
        registerContentInvalid(
          this.slotBoundary,
          () => {
            invalidateExposedSlotContent(this)
            const anchor = this.anchor
            const parent = anchor.parentNode
            if (parent) {
              removeAttachedNodes(this.content, parent)
              if (this.activeFallback) {
                removeAttachedNodes(this.activeFallback, parent)
              }
              removeNode(anchor, parent)
            }
          },
          this,
        )
      }
    }
    if (!isHydrating) {
      this.insert = (parent, anchor, parentSuspense) =>
        this.insertSlot(parent, anchor, parentSuspense)
    }
    this.remove = parent => this.removeSlot(parent)
  }

  // updateSlot owns hydration timing, so opt out of autoHydrate.
  protected get autoHydrate(): boolean {
    return false
  }

  // The content branch is parked outside `nodes` while a fallback is active,
  // but must still receive slotted scope ids (see applySlottedScopeId).
  parkedContent(): Block | undefined {
    return this.content !== this.nodes ? this.content : undefined
  }

  get boundary(): SlotBoundaryContext {
    return (this.ownBoundary ||= {
      parent: this.inheritFallback ? this.slotBoundary : null,
      getFallback: () => this.localFallback,
      run: (fn, scope) => this.runWithRenderCtx(fn, scope),
      markDirty: force => markSlotResolutionDirty(this, force),
      onContentInvalid: this.onContentInvalid,
    })
  }

  private insertSlot(
    parent: ParentNode,
    anchor: Node | null,
    parentSuspense?: SuspenseBoundary | null,
  ): void {
    this.disposed = false
    insert(this.nodes, parent, anchor, parentSuspense)
    if (this.activeFallback === this.nodes) {
      this.fallbackInserted = true
    }
  }

  private removeSlot(parent?: ParentNode): void {
    this.disposed = true
    const nodes = this.nodes
    remove(nodes, parent)
    if (this.activeFallback === nodes) {
      // the exposed fallback was just torn down by remove() above; null it
      // so disposeSlotResolution does not remove it a second time
      this.activeFallback = null
      this.fallbackInserted = false
    }
    this.onContentInvalid.length = 0
    disposeSlotResolution(this)
  }

  protected getBranchParent(): ParentNode | null {
    // When fallback is active, recompute content without inserting it. The
    // content may still be invalid, so recheckSlotResolution decides whether it
    // can return to the DOM.
    return this.activeFallback ? null : super.getBranchParent()
  }

  private updateContent(render: BlockFn | undefined, key: any): void {
    if (key !== this.current) {
      this.onContentInvalid.length = 0
    }
    // update() operates on this.nodes, but while fallback is active `nodes`
    // points at the fallback block. Aim it at the content branch so the base
    // pipeline re-renders content, then capture the result back; the
    // subsequent recheckSlotResolution decides what `nodes` exposes
    // (syncNodes).
    this.nodes = this.content
    this.update(render, key)
    this.content = this.nodes
  }

  private updateHydratingContent(
    render: BlockFn | undefined,
    key: any,
  ): { contentStart: Node | null; contentValid: boolean } {
    const contentStart = currentHydrationNode
    let finish: ((contentValid: boolean) => void) | null = null
    try {
      if (this.sharedFallback || hasSlotFallback(this.boundary)) {
        finish = startPendingSlotContent(contentStart)
      }
      this.updateContent(render, key)
      const contentValid = isValidSlot(this.content)
      if (finish) {
        finish(contentValid)
        finish = null
      }
      return { contentStart, contentValid }
    } finally {
      if (finish) {
        finish(true)
      }
    }
  }

  updateSlot(
    render?: BlockFn,
    fallback?: BlockFn,
    key: any = render || fallback,
  ): void {
    const prevLocalFallback = this.localFallback
    this.localFallback = fallback
    const boundary = this.boundary
    const slotRender = render
      ? () => withSlotBoundary(boundary, render)
      : () => EMPTY_BLOCK
    this.isUpdating = true
    this.pendingRecheck = false

    try {
      const shouldForce = prevLocalFallback !== fallback
      if (isHydrating) {
        // Forwarded roots that do not own an inherited fallback restore only
        // their exposed branch. The receiver decides its fallback after all
        // shared roots have reported their final content/local-fallback result.
        if (this.sharedFallback || (this.inheritFallback && !fallback)) {
          const { contentStart, contentValid } = this.updateHydratingContent(
            slotRender,
            key,
          )
          let exposedValid = contentValid
          if (this.sharedFallback) {
            recheckSlotResolution(this, shouldForce || this.pendingRecheckForce)
            exposedValid = isValidSlot(this.nodes)
          } else {
            this.syncNodes()
            this.lastNodesValid = contentValid
          }
          if (exposedValid) {
            const end =
              contentStart && isComment(contentStart, '[')
                ? locateEndAnchor(contentStart)
                : null
            if (end) {
              this.anchor = markHydrationAnchor(end)
              advanceHydrationNode(end)
            } else {
              hydrateDynamicFragmentAnchor(this, !isValidBlock(this.nodes))
            }
          } else if (this.sharedFallback) {
            const slotEnd = getCurrentSlotEndAnchor()
            const end =
              contentStart && isComment(contentStart, '[')
                ? locateEndAnchor(contentStart)
                : null
            if (end && end !== slotEnd) {
              // Move past this candidate range so later sibling roots hydrate
              // from their own position. The parent aggregate decision below
              // determines whether this root actually owns the range.
              advanceHydrationNode(end)
            }
            const anchor = markHydrationAnchor(
              __DEV__
                ? createComment(this.anchorLabel ?? '')
                : createTextNode(),
            )
            this.anchor = anchor
            const previous = slotEnd && slotEnd.previousSibling
            if (previous && isComment(previous, ']')) {
              markHydrationAnchor(previous)
            }
            const attachContent = () => {
              const candidate = end && end !== slotEnd ? end : null
              const insertionAnchor =
                candidate ||
                (contentStart && contentStart.parentNode
                  ? contentStart
                  : slotEnd)
              const parent = insertionAnchor && insertionAnchor.parentNode
              if (!parent) return

              if (candidate) {
                this.anchor = markHydrationAnchor(candidate)
              } else {
                parent.insertBefore(anchor, insertionAnchor)
              }
              move(this.nodes, parent, this.anchor)
            }
            const queued = queuePendingSlotContentAnchor({
              onContent: attachContent,
              onFallback: () => {},
            })
            if (!queued) {
              if (end && end !== slotEnd) {
                markHydrationAnchor(end)
              }
              queuePostFlushCb(attachContent)
            }
          } else {
            // Empty forwarded content should not claim the receiver slot's
            // SSR close marker. Queue its runtime anchor before that marker so
            // fallback hydration can finish first and the final DOM matches CSR.
            const anchor = (this.anchor = markHydrationAnchor(
              __DEV__
                ? createComment(this.anchorLabel ?? '')
                : createTextNode(),
            ))
            const slotEnd = getCurrentSlotEndAnchor()
            const parent = slotEnd && slotEnd.parentNode
            if (parent) {
              const previous = slotEnd.previousSibling
              if (previous && isComment(previous, ']')) {
                // When the receiver fallback is a fragment, the node right
                // before the receiver slot end is the fallback fragment's SSR
                // close. This forwarded slot does not own that marker, but
                // boundary cleanup runs before the queued anchor is inserted,
                // so mark it now.
                markHydrationAnchor(previous)
              }

              queuePostFlushCb(() => {
                if (slotEnd.parentNode === parent) {
                  parent.insertBefore(anchor, slotEnd)
                }
              })
            }
          }
        } else {
          withHydratingSlotBoundary(() => {
            this.updateHydratingContent(slotRender, key)
            recheckSlotResolution(this, shouldForce || this.pendingRecheckForce)
            hydrateDynamicFragmentAnchor(this, !isValidBlock(this.nodes))
          })
        }
      } else {
        this.updateContent(slotRender, key)
        recheckSlotResolution(this, shouldForce || this.pendingRecheckForce)
      }
    } finally {
      this.pendingRecheck = false
      this.pendingRecheckForce = false
      this.isUpdating = false
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
    return this.isUpdating
  }

  isDisposed(): boolean {
    return this.disposed
  }

  isContentValid(): boolean {
    return isValidSlot(this.content)
  }

  syncNodes(): void {
    this.nodes = this.activeFallback || this.content
  }

  notifyExposedValidityChange(): void {
    if (this.notifyParentBoundary && this.slotBoundary) {
      this.slotBoundary.markDirty()
    }
  }
}

/**
 * Adopt the template `<!>` placeholder passed through the insertion state as
 * the fragment anchor instead of creating (and later inserting) a runtime
 * anchor. Restricted to comments: adopting any other node would remove user
 * DOM on removeFragment. Callers detect adoption by identity: the returned
 * node is the adopted anchor iff it equals the passed one.
 */
export function resolveFragmentAnchor(
  adopt: Node | undefined,
  anchorLabel: string | undefined,
): Node {
  if (adopt && adopt.nodeType === 8 /* Comment */) {
    if (__DEV__ && anchorLabel) (adopt as Comment).data = anchorLabel
    return adopt
  }
  return __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
}

/**
 * Whether a fragment adopted the captured insertion anchor as its own, which
 * means it rendered in place and the creator must skip its trailing insert.
 * The insertion anchor must be checked non-null: append inserts capture no
 * anchor, and fragments without a client anchor (vdom interop slots, any
 * fragment during hydration) would otherwise compare undefined === undefined
 * and falsely skip their only insertion.
 */
export function isAdoptedAnchor(
  fragmentAnchor: Node | undefined,
  insertionAnchor: Node | undefined,
): boolean {
  return !!insertionAnchor && fragmentAnchor === insertionAnchor
}

export function isFragment(val: unknown): val is VaporFragment {
  return !!(val && (val as any).__vf)
}

export type InteropFragment<T extends Block = Block> = VaporFragment<T> & {
  vnode: VNode | null
  syncScopeId: (this: InteropFragment) => void
  // Swaps the slotted-id context stored as VNode metadata inside the
  // fragment's backing VNode tree, so future effective-root mounts in a
  // kept subtree inherit the fresh context (see updateSlottedScopeId).
  updateScopeIdContext: (
    this: InteropFragment,
    prev: VaporComponentInstance['scopeId'],
    next: VaporComponentInstance['scopeId'],
  ) => void
}

export function isInteropFragment(val: unknown): val is InteropFragment {
  return !!(val && (val as any).__vf & VDOM)
}

export function isDynamicFragment(val: unknown): val is DynamicFragment {
  return !!(val && (val as any).__vf & DYNAMIC)
}

export function isForFragment(val: unknown): val is ForFragment {
  return !!(val && (val as any).__vf & FOR)
}

export function isForBlock(val: unknown): val is ForBlock {
  return !!(val && (val as any).__vf & FOR_ITEM)
}

export function isSlotFragment(val: unknown): val is SlotFragment {
  return !!(val && (val as any).__vf & SLOT)
}
