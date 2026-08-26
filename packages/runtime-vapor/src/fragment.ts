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
  type HydrationCursor,
  advanceHydrationNode,
  claimAnchor,
  claimUntrackedAnchor,
  currentHydrationNode,
  exitHydrationCursor,
  isComment,
  isHydrating,
  locateFragmentEnd,
  locateHydrationNode,
} from './dom/hydration'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots'
import {
  isSuspenseEnabled,
  parentSuspense,
  setParentSuspense,
} from './suspense'
import {
  applyScopeIdOwners,
  currentSlotScopeIds,
  setCurrentSlotScopeIds,
} from './scopeId'
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
  startPendingSlotContentGuard,
  withHydratingSlotBoundary,
} from './dom/hydrateFragment'
import {
  type SlotResolutionState,
  disposeSlotResolution,
  invalidateExposedSlotContent,
  markSlotResolutionDirty,
  recheckSlotResolution,
  resolveExposedSlotNodes,
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
  SLOT_OUTLET,
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
  setRef?: (
    instance: VaporComponentInstance,
    ref: NodeRef,
    refFor: boolean,
    refKey: string | undefined,
  ) => void

  // hooks
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
  // The Suspense boundary this fragment renders *into*. Unlike
  // `renderInstance.suspense` (the boundary its owner was mounted in), slot
  // content can be declared outside a boundary and rendered inside one, so this
  // has to be the ambient value at construction time. Restored alongside the
  // other fragment-owned ambient state in `runWithFragmentCtxOnly`, so
  // branches that first render during an update queue their post-render
  // effects on the right boundary instead of the global queue.
  readonly renderSuspense?: SuspenseBoundary | null
  // Captured by reference: slot outlets replace this with their merged id cell
  // right after construction, so late renders (branch switches, deferred
  // fallbacks) create their DOM under the outlet's slot scope context.
  slotScopeIds: string[] | null = currentSlotScopeIds

  constructor(nodes: T, flags: number = FRAGMENT) {
    super(nodes, flags)
    if (isKeepAliveEnabled) {
      this.keepAliveCtx = getKeepAliveContext(currentInstance)
    }
    if (__FEATURE_SUSPENSE__ && isSuspenseEnabled) {
      this.renderSuspense = parentSuspense
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

/**
 * The one construction point for a slot host's boundary context, shared by
 * SlotFragment and both vdom-interop slot hosts. `run` and `getScopeIds`
 * always come from the host fragment's render seam; `parent`, `getFallback`
 * and `markDirty` stay host-specific (ownership caps, fallback sources and
 * dirty batching differ per host).
 */
export function createSlotBoundary(
  fragment: RenderContextFragment,
  parent: SlotBoundaryContext | null,
  getFallback: () => BlockFn | undefined,
  markDirty: (force?: boolean) => void,
  onContentInvalid?: (() => void)[],
): SlotBoundaryContext {
  return {
    parent,
    getFallback,
    run: (fn, scope) => runWithRenderCtx(fragment, fn, scope),
    getScopeIds: () => fragment.slotScopeIds,
    markDirty,
    onContentInvalid,
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
  const suspense =
    __FEATURE_SUSPENSE__ && isSuspenseEnabled
      ? fragment.renderSuspense || null
      : null
  const restoreSuspense =
    __FEATURE_SUSPENSE__ && isSuspenseEnabled && parentSuspense !== suspense
  if (
    !restoreSuspense &&
    currentSlotOwner === fragment.slotOwner &&
    currentSlotBoundary === fragment.slotBoundary &&
    currentSlotScopeIds === fragment.slotScopeIds
  ) {
    return fn()
  }

  const prevSuspense = restoreSuspense ? setParentSuspense(suspense) : null
  const prevSlotOwner = setCurrentSlotOwner(fragment.slotOwner)
  const prevBoundary = setCurrentSlotBoundary(fragment.slotBoundary)
  const prevSlotScopeIds = setCurrentSlotScopeIds(fragment.slotScopeIds)
  try {
    return fn()
  } finally {
    setCurrentSlotScopeIds(prevSlotScopeIds)
    setCurrentSlotBoundary(prevBoundary)
    setCurrentSlotOwner(prevSlotOwner)
    if (restoreSuspense) setParentSuspense(prevSuspense)
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
  // Debug text for the runtime anchor comment, dev builds only. Never a
  // category signal: everything hydration branches on lives in `__vf`.
  anchorLabel?: string
  keyed?: boolean
  inTransition?: boolean
  // Fallthrough (re-)application for this fragment's branches, installed by
  // the owning component when the fragment sits on its fallthrough root
  // chain. Invoked inside the branch render ctx so created effects capture
  // the correct instance and land in branch scopes; its presence also forces
  // scopes for compiler-proven no-scope branches.
  fallthrough?: (nodes: Block) => void
  // Ancestor instances whose root-only scope ids resolve through this
  // fragment; branch switches re-apply them to the new root before insertion.
  scopeIdOwners?: VaporComponentInstance[]
  // Whether update() ran before. The very first update renders as part of
  // the mount and must not fire onUpdated hooks; with an adopted template
  // anchor `parent` is non-null even then, so mount status can no longer be
  // inferred from the anchor being detached.
  everUpdated = false
  constructor(
    // subtype bits only (IF, NATIVE_CHILDREN, SLOT_FRAGMENT...); the class
    // invariant DYNAMIC is added here so it cannot be forgotten
    flags: number = 0,
    anchorLabel?: string,
    keyed: boolean = false,
    locate: boolean = true,
    trackSlotBoundary: boolean = false,
    onInvalid?: () => void,
    adoptAnchor?: Node,
  ) {
    super(EMPTY_BLOCK, DYNAMIC | flags)
    if (keyed) this.keyed = true
    if (
      isTransitionEnabled &&
      currentInstance &&
      isVaporTransition(currentInstance.type)
    ) {
      this.inTransition = true
    }
    if (__DEV__) this.anchorLabel = anchorLabel
    if (isHydrating) {
      if (locate) locateHydrationNode()
    } else {
      this.anchor = resolveFragmentAnchor(adoptAnchor, anchorLabel)
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
      const useScope = !noScope || !!this.fallthrough
      if (!keepAliveCtx) {
        this.scope = useScope ? new EffectScope() : undefined
      }

      const renderBranch = () => {
        try {
          this.nodes = this.runWithRenderCtx(() => {
            const nodes =
              (useScope ? this.scope!.run(render) : render()) || EMPTY_BLOCK
            // (Re-)apply fallthrough attrs for the new branch inside the
            // render ctx, before insertion. Disconnected renders are skipped
            // on purpose: the enclosing application traverses into them and
            // owns their first application.
            if (parent && this.fallthrough) this.fallthrough(nodes)
            return nodes
          }, this.scope)
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

      // Root-only inherited ids must land on the new branch's effective root
      // before insertion so custom element callbacks observe them.
      if (this.scopeIdOwners) applyScopeIdOwners(this.scopeIdOwners)

      if (parent) {
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
      SLOT_FRAGMENT,
      __DEV__ ? 'slot' : undefined,
      false,
      false,
      false,
      undefined,
      adoptAnchor,
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

  get boundary(): SlotBoundaryContext {
    return (this.ownBoundary ||= createSlotBoundary(
      this,
      this.inheritFallback ? this.slotBoundary : null,
      () => this.localFallback,
      force => markSlotResolutionDirty(this, force),
      this.onContentInvalid,
    ))
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
    const pending = startPendingSlotContentGuard(
      this.sharedFallback || hasSlotFallback(this.boundary),
      contentStart,
    )
    try {
      this.updateContent(render, key)
      const contentValid = isValidSlot(this.content)
      pending.finish(contentValid)
      return { contentStart, contentValid }
    } finally {
      pending.settle()
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
            const end = locateFragmentEnd(contentStart)
            if (end) {
              this.anchor = claimAnchor(end)
              advanceHydrationNode(end)
            } else {
              hydrateDynamicFragmentAnchor(this, !isValidBlock(this.nodes))
            }
          } else if (this.sharedFallback) {
            const slotEnd = getCurrentSlotEndAnchor()
            const end = locateFragmentEnd(contentStart)
            if (end && end !== slotEnd) {
              // Move past this candidate range so later sibling roots hydrate
              // from their own position. The parent aggregate decision below
              // determines whether this root actually owns the range.
              advanceHydrationNode(end)
            }
            const anchor = claimUntrackedAnchor(
              __DEV__
                ? createComment(this.anchorLabel ?? '')
                : createTextNode(),
            )
            this.anchor = anchor
            const previous = slotEnd && slotEnd.previousSibling
            if (previous && isComment(previous, ']')) {
              claimAnchor(previous)
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
                this.anchor = claimAnchor(candidate)
              } else {
                parent.insertBefore(anchor, insertionAnchor)
              }
              move(this.nodes, parent, this.anchor)
            }
            // Post-flush even after the verdict: the reference node's final
            // position is only stable once the whole pass has finished.
            const queued = queuePendingSlotContentAnchor({
              onContent: attachContent,
              onFallback: () => {},
            })
            if (!queued) {
              if (end && end !== slotEnd) {
                claimAnchor(end)
              }
              queuePostFlushCb(attachContent)
            }
          } else {
            // Empty forwarded content should not claim the receiver slot's
            // SSR close marker. Queue its runtime anchor before that marker so
            // fallback hydration can finish first and the final DOM matches CSR.
            const anchor = (this.anchor = claimUntrackedAnchor(
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
                claimAnchor(previous)
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
    this.nodes = resolveExposedSlotNodes(this, this.content)
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
    return claimUntrackedAnchor(adopt)
  }
  return claimUntrackedAnchor(
    __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode(),
  )
}

/**
 * Whether a fragment adopted the captured insertion anchor — the template
 * `<!>` placeholder — as its own, which means it rendered in place and the
 * creator must skip its trailing insert. Unrelated to hydration's
 * `isClaimedAnchor` / `skipUntrackedAnchors`, which are about anchor nodes
 * marked during a hydration pass.
 *
 * The insertion anchor must be checked non-null: append inserts capture no
 * anchor, and fragments without a client anchor (vdom interop slots, any
 * fragment during hydration) would otherwise compare undefined === undefined
 * and falsely skip their only insertion.
 */
export function isAdoptedPlaceholder(
  fragmentAnchor: Node | undefined,
  insertionAnchor: Node | undefined,
): boolean {
  return !!insertionAnchor && fragmentAnchor === insertionAnchor
}

/**
 * Shared tail for every block-creating API (`createIf`, `createFor`,
 * `createKeyedFragment`, `createDynamicComponent`, slot outlets): the block is
 * built, now hand it over to the scope that asked for it.
 *
 * Client render: insert it at the captured insertion point, unless it adopted
 * that point's `<!>` placeholder as its own anchor and therefore already
 * rendered in place. Hydration: there is nothing to insert — the block adopted
 * server nodes where they already stood — so hand back the cursor instead.
 *
 * Site-specific hydration work (claiming a leftover `<!---->`, advancing past
 * an anchor, running an interop fragment's `hydrate()`) belongs *before* this
 * call, guarded by `isHydrating`; keeping it out of here avoids allocating a
 * callback on the client-render path, which never needs one.
 */
export function finishBlockCreation(
  block: Block,
  anchor: Node | undefined,
  cursor: HydrationCursor | null,
  insertionParent: ParentNode | undefined,
  insertionAnchor: Node | undefined,
  /** force insertion even when the anchor was adopted (custom element slots) */
  force?: boolean,
): void {
  if (isHydrating) {
    exitHydrationCursor(cursor)
  } else if (
    insertionParent &&
    (force || !isAdoptedPlaceholder(anchor, insertionAnchor))
  ) {
    insert(block, insertionParent, insertionAnchor)
  }
}

export function isFragment(val: unknown): val is VaporFragment {
  return !!(val && (val as any).__vf)
}

export type InteropFragment<T extends Block = Block> =
  RenderContextFragment<T> & {
    vnode: VNode | null
  }

export function isInteropFragment(val: unknown): val is InteropFragment {
  return !!(val && (val as any).__vf & VDOM)
}

export function isSlotOutletFragment(val: unknown): boolean {
  return !!(val && (val as any).__vf & SLOT_OUTLET)
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
