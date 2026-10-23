import {
  EffectScope,
  type ShallowRef,
  onScopeDispose,
  setActiveSub,
} from '@vue/reactivity'
import { NO, slotNotifiesBoundary } from '@vue/shared'
import { createComment, createTextNode } from './dom/node'
import { pendingDomUpdates } from './dom/async'
import {
  type Block,
  type BlockFn,
  EMPTY_BLOCK,
  type TransitionOptions,
  type VaporTransitionHooks,
  insert,
  isValidSlot,
  registerNestedVDOMCleanup,
  remove,
} from './block'
import {
  type GenericComponentInstance,
  type MoveType,
  type SuspenseBoundary,
  type TransitionHooks,
  type VNode,
  currentInstance,
  restoreCurrentInstance,
  setCurrentInstance,
} from '@vue/runtime-dom'
import type { VaporComponentInstance } from './component'
import type { NodeRef } from './apiTemplateRef'
import type { KeyContext } from './components/Transition'
import {
  type FragmentClaim,
  type HydrationCursor,
  claimUntrackedAnchor,
  exitHydrationCursor,
  isHydrating,
} from './dom/hydration'
import {
  type RenderContext,
  currentRenderContext,
  deriveSlotBoundary,
  withRenderContext,
} from './renderContext'
import { applyScopeIdOwners } from './scopeId'
import type { SlotBoundaryContext } from './slotBoundary'
import {
  hydrateDynamicFragmentAnchor,
  hydrateSlotFragmentContent,
  prepareDeferredHydrationAnchor,
} from './dom/hydrateFragment'
import {
  type RenderedSlotFallback,
  type SlotResolutionState,
  disposeSlotResolution,
  isHoldingSlotContent,
  markSlotResolutionDirty,
  placeSlotContent,
  recheckSlotResolution,
  resolveExposedSlotNodes,
} from './slotFragment'
import {
  type VaporKeepAliveContext,
  getKeepAliveContext,
  isKeepAliveEnabled,
} from './keepAlive'
import {
  applyTransitionHooks,
  deferBranchUpdateDuringLeave,
  deferSlotRootFlip,
  isTransitionEnabled,
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
  SLOT_RESOLVER,
  SLOT_ROOT,
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
  $tkey?: any
  $ttype?: any
  $keyCtx?: KeyContext
  nodes: T
  vnode?: VNode | null
  anchor?: Node
  isBlockValid?: (componentAsValid?: boolean) => boolean
  // a slot host: its content, in the DOM ahead of the fallback it exposes
  getContent?(): Block
  // a slot host patching vnode content: `cb` follows the leave its content
  // root is running on its own, if any
  awaitLeavingRoot?(cb: () => void): boolean
  // a slot outlet: the slot's name, the stem of the keys Transition composes
  // under its branches (`_<name>`, `_<name>_fb`)
  slotName?: string
  insert?(
    parent: ParentNode,
    anchor: Node | null,
    parentSuspense?: SuspenseBoundary | null,
    transitionHooks?: TransitionHooks,
  ): void
  move?(
    parent: ParentNode,
    anchor: Node | null,
    moveType: MoveType,
    parentComponent?: VaporComponentInstance,
    parentSuspense?: SuspenseBoundary | null,
    transitionHooks?: TransitionHooks,
  ): void
  remove?(parent?: ParentNode, transitionHooks?: TransitionHooks): void
  hydrate?(...args: any[]): void
  /** @internal interop: patch this mounted vnode with a same-type successor */
  patchVNode?: (next: VNode) => void
  scope?: EffectScope
  /**
   * @internal the KeepAlive-owned input scope, paused while cached
   */
  inputScope?: EffectScope
  setRef?: (
    instance: VaporComponentInstance,
    ref: NodeRef,
    refFor: boolean,
    refKey: string | undefined,
  ) => void
  /**
   * @internal vdom interop protocol, implemented by interop fragments so
   * structural features act on VDOM-backed content without reaching into the
   * backing vnode. `hasVDOMContent` is dynamic: an interop slot fragment
   * exposing a vapor fallback has no backing vnode at that moment.
   */
  hasVDOMContent?: (this: VaporFragment) => boolean
  /** @internal mirrors a block key onto the backing vnode for keyed paths */
  setKey?: (this: VaporFragment, key: any) => void
  /** @internal resolved transition child type of the backing vnode */
  getTransitionType?: (this: VaporFragment) => any
  /** @internal live transition element of the backing vnode's subtree */
  getTransitionElement?: (this: VaporFragment) => Element | undefined

  /** beforeMount: a fresh branch carries its transition hooks but is not
   * inserted yet */
  bm?: ((nodes: Block) => void)[]
  /** beforeUnmount */
  bum?: (() => void)[]
  /** beforeUpdate */
  bu?: (() => void)[]
  /** updated */
  u?: ((nodes: Block) => void)[]

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
// the for pipeline captures the context once per v-for instead.
export class RenderContextFragment<
  T extends Block = Block,
> extends VaporFragment<T> {
  readonly renderInstance: GenericComponentInstance | null = currentInstance
  readonly keepAliveCtx?: VaporKeepAliveContext | null
  // The context this fragment's content renders under. A slot outlet is built
  // under its own cell (see createSlot), so late renders create their DOM
  // under the outlet's context.
  ctx: RenderContext = currentRenderContext

  constructor(nodes: T, flags: number = FRAGMENT) {
    super(nodes, flags)
    if (isKeepAliveEnabled) {
      this.keepAliveCtx = getKeepAliveContext(currentInstance)
    }
  }

  get slotBoundary(): SlotBoundaryContext | null {
    return this.ctx.slotBoundary
  }

  get slotScopeIds(): string[] | null {
    return this.ctx.slotScopeIds
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
  // Renders driven by the fragment's own render effect already run under its
  // instance; only out-of-effect renders (slot fallbacks, deferred branches,
  // async resolution) switch it.
  if (scope === undefined && currentInstance === fragment.renderInstance) {
    return withRenderContext(fragment.ctx, fn)
  }
  const prevInstance = setCurrentInstance(fragment.renderInstance, scope)
  try {
    return withRenderContext(fragment.ctx, fn)
  } finally {
    restoreCurrentInstance(prevInstance)
  }
}

const noParentBoundary = (): null => null

/**
 * The one construction point for a slot host's boundary context, shared by
 * SlotFragment and both vdom-interop slot hosts. `run` always comes from the
 * host fragment's render seam, and so does the id cell unless the boundary
 * stands for another outlet of the host (see `getParent`).
 */
export function createSlotBoundary(
  fragment: RenderContextFragment,
  getFallback: () => BlockFn | undefined,
  markDirty: () => void,
  // the host's own hold (isHoldingSlotContent), on top of the enclosing
  // outlet's
  isHoldingContent?: () => boolean,
  // the host fragment's cell unless the boundary stands for another outlet
  getScopeIds: () => string[] | null = () => fragment.slotScopeIds,
  // a getter: the chain above an interop outlet follows the outlets recorded
  // on its latest vnode
  getParent: () => SlotBoundaryContext | null = noParentBoundary,
): SlotBoundaryContext {
  // Transition is set up before anything under it is created: without it,
  // nothing ever holds.
  const isHeld = !isTransitionEnabled
    ? NO
    : () => {
        const enclosing = fragment.slotBoundary
        return !!enclosing && enclosing.isHolding()
      }
  return {
    getParent,
    getFallback,
    run: (fn, scope) => runWithRenderCtx(fragment, fn, scope),
    getScopeIds,
    markDirty,
    isHolding:
      isTransitionEnabled && isHoldingContent
        ? () => isHoldingContent() || isHeld()
        : isHeld,
    isHeld,
  }
}

export class ForFragment extends VaporFragment<Block[]> {
  // Listeners fired when the v-for resets its items in one shot
  // (whole-list clear or full remount). Selectors hook in here via
  // `frag.onReset(selector.reset)` so they can drop their internal state in
  // O(1) instead of N per-item Map.delete calls.
  resetListeners?: (() => void)[]

  constructor(nodes: Block[]) {
    super(nodes, FOR)
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

// Whether a fragment's next branch renders detached: a slot outlet showing
// (or, out-in, leaving) a fallback under a Transition holds its own content
// and the slot roots under it; the outlet places them (slotFragment.ts).
function isBranchHeld(frag: DynamicFragment): boolean {
  return frag.__vf & SLOT_RESOLVER
    ? (frag as SlotFragment).boundary.isHolding()
    : !!(frag.__vf & SLOT_ROOT) && frag.slotBoundary!.isHolding()
}

export class DynamicFragment extends RenderContextFragment {
  // @ts-expect-error - assigned in the constructor or hydrateDynamicFragmentAnchor()
  anchor: Node
  scope: EffectScope | undefined
  // Key of the branch update() is heading to; undefined until the first
  // branch renders. Written before the leave/defer scheduling, so an update
  // that targets the in-flight key during a leave is a no-op rather than a
  // revival of the outgoing branch.
  current?: any
  // Owned by the Transition module (deferBranchUpdateDuringLeave /
  // removeBranchWithLeave); the core update pipeline never touches it.
  pending?: {
    render?: BlockFn
    key: any
    noScope: boolean
    branchKey?: any
    // key mounted when the first update was deferred
    prevKey?: any
  }
  // out-in: the current branch is leaving and is removed once it has left
  leaving?: boolean
  // Debug text for the runtime anchor comment, dev builds only. Never a
  // category signal: everything hydration branches on lives in `__vf`.
  anchorLabel?: string
  keyed?: boolean
  // The user-facing key of the current branch: the branch key itself for
  // keyed fragments, or the `:key` a dynamic component carries next to its
  // resolved-component identity. KeepAlive caches by it and Transition reads
  // it as the default key of the branch root.
  branchKey?: any
  /** hydration: this `v-if` branch's claim on its SSR range */
  hydrationClaim?: FragmentClaim
  // Fallthrough (re-)application for this fragment's branches, installed by
  // the owning component when the fragment sits on its fallthrough root
  // chain. Invoked inside the branch render ctx so created effects capture
  // the correct instance and land in branch scopes; its presence also forces
  // scopes for compiler-proven no-scope branches.
  fallthrough?: (nodes: Block) => void
  // Ancestor instances whose root-only scope ids resolve through this
  // fragment; branch switches re-apply them to the new root before insertion.
  scopeIdOwners?: VaporComponentInstance[]
  // slot root: validity before the update in flight
  wasValid?: boolean
  // Whether update() ran before. The very first update renders as part of
  // the mount and must not fire updated hooks; with an adopted template
  // anchor `parent` is non-null even then, so mount status can no longer be
  // inferred from the anchor being detached.
  everUpdated = false
  constructor(
    // subtype bits only (IF, NATIVE_CHILDREN, SLOT_FRAGMENT...); the class
    // invariant DYNAMIC is added here so it cannot be forgotten
    flags: number = 0,
    anchorLabel?: string,
    keyed: boolean = false,
    slotRoot: boolean = false,
    adoptAnchor?: Node,
  ) {
    super(
      EMPTY_BLOCK,
      DYNAMIC |
        flags |
        (slotRoot && currentRenderContext.slotBoundary ? SLOT_ROOT : 0),
    )
    if (keyed) this.keyed = true
    if (__DEV__) this.anchorLabel = anchorLabel
    if (!isHydrating) {
      this.anchor = resolveFragmentAnchor(adoptAnchor, anchorLabel)
    }
  }

  // Whether update() claims the SSR anchor itself during hydration.
  // SlotFragment opts out: updateSlot owns its hydration timing.
  protected get autoHydrate(): boolean {
    return true
  }

  update(
    render?: BlockFn,
    key: any = render,
    noScope: boolean = false,
    branchKey?: any,
  ): void {
    if (pendingDomUpdates && this.everUpdated) {
      pendingDomUpdates.push(() => this.update(render, key, noScope, branchKey))
      return
    }
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
    const prevKey = this.current
    const wasMounted = prevKey !== undefined
    this.current = key
    const prevSub = setActiveSub()
    let reusingDeferredAnchor = false
    try {
      const liveParent = isHydrating ? null : this.anchor.parentNode
      // a held slot root renders detached; its outlet places the branch
      const parent =
        liveParent && isTransitionEnabled && isBranchHeld(this)
          ? null
          : liveParent
      // Every update after the mount-time render brackets its hooks; see the
      // `everUpdated` field comment.
      const isUpdate = wasMounted || (everUpdated && !!parent)
      if (isUpdate) {
        if (this.__vf & SLOT_ROOT) this.wasValid = isValidSlot(this)
        const bu = this.bu
        if (bu) {
          for (let i = 0; i < bu.length; i++) {
            bu[i]()
          }
        }
      }
      // currently leaving: defer mounting the next branch until
      // the leave finishes. A branch rendering out of the DOM (a held slot
      // root) is in nobody's way.
      if (
        transition &&
        parent &&
        deferBranchUpdateDuringLeave(
          this,
          render,
          key,
          noScope,
          branchKey,
          prevKey,
        )
      ) {
        return
      }

      let removePrevious: (() => void) | undefined
      // rendering past a leave of its own (unpaired): the root that left
      // finishes where it is, the fragment goes on without it
      if (isTransitionEnabled && this.leaving) {
        this.leaving = false
        this.pending = undefined
      } else if (wasMounted) {
        // teardown previous branch
        const scope = this.scope
        const previous = this.nodes
        const removeBranch = () => remove(previous, liveParent || undefined)
        let deferRemoval = false
        if (scope) {
          if (this.keepAliveCtx) {
            deferRemoval = this.keepAliveCtx.prepareBranchRemoval(
              this,
              scope,
              prevKey,
            )
          } else {
            scope.stop()
          }
        }
        if (
          transition &&
          parent &&
          removeBranchWithLeave(
            this,
            transition,
            parent,
            render,
            key,
            noScope,
            branchKey,
          )
        ) {
          // out-in: the next branch mounts after the leave finishes.
          return
        }
        if (deferRemoval) {
          removePrevious = removeBranch
        } else {
          removeBranch()
        }
      }

      reusingDeferredAnchor = isHydrating
        ? prepareDeferredHydrationAnchor(this, !!render)
        : false

      this.renderBranch(
        render,
        // in-out leave may have swapped in the hooks for the incoming branch
        transition && this.$transition,
        parent,
        key,
        noScope,
        isUpdate,
        removePrevious,
        branchKey,
      )
    } finally {
      setActiveSub(prevSub)
    }

    if (isHydrating && this.autoHydrate && !reusingDeferredAnchor) {
      hydrateDynamicFragmentAnchor(this, render == null)
    }
  }

  renderBranch(
    render: BlockFn | undefined,
    transition: VaporTransitionHooks | undefined,
    parent: ParentNode | null,
    key: any,
    noScope: boolean,
    notifyUpdated: boolean,
    removePrevious?: () => void,
    branchKey?: any,
  ): void {
    this.branchKey = this.keyed ? key : branchKey
    if (render) {
      const keepAliveCtx = isKeepAliveEnabled ? this.keepAliveCtx : null
      // A compiler-proven static branch can skip its own EffectScope, but attrs
      // fallthrough still registers branch-owned cleanup.
      const useScope = !noScope || !!this.fallthrough
      if (keepAliveCtx) {
        keepAliveCtx.runBranchRender(
          this,
          () => this.renderNodes(render, useScope, parent, transition),
          useScope,
          removePrevious,
        )
      } else {
        this.scope = useScope ? new EffectScope() : undefined
        this.renderNodes(render, useScope, parent, transition)
      }

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

    if (notifyUpdated) {
      // a slot root reports its validity flips to the enclosing outlet
      if (
        this.__vf & SLOT_ROOT &&
        isValidSlot(this) !== this.wasValid &&
        !(isTransitionEnabled && this.$transition && deferSlotRootFlip(this))
      ) {
        this.slotBoundary!.markDirty()
      }
      const u = this.u
      if (u) {
        for (let i = 0; i < u.length; i++) {
          u[i](this.nodes)
        }
      }
    }
  }

  private renderNodes(
    render: BlockFn,
    useScope: boolean,
    parent: ParentNode | null,
    transition: VaporTransitionHooks | undefined,
  ): void {
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
      })
    } finally {
      if (isTransitionEnabled && transition) {
        this.$transition = applyTransitionHooks(this.nodes, transition, this)
      }
    }
    const bm = this.bm
    if (bm) {
      for (let i = 0; i < bm.length; i++) bm[i](this.nodes)
    }
  }
}

// SlotFragment must live in the same module as DynamicFragment: `extends`
// reads the base class binding at module evaluation time, and fragment.ts
// sits inside a module cycle (block → component → componentSlots → fragment),
// so a class hoisted into another module can hit the base class before it is
// initialized depending on entry order.
export class SlotFragment
  extends DynamicFragment
  implements SlotResolutionState
{
  private disposed = false
  activeFallback: Block | null = null
  fallbackScope?: EffectScope
  renderedFallbacks?: RenderedSlotFallback[]
  lastNodesValid?: boolean
  held?: SlotResolutionState['held']
  holdsContent = true
  pendingRecheck = false
  isReconciling = false
  private content: Block = EMPTY_BLOCK
  private localFallback?: BlockFn
  private isUpdating = false
  private ownBoundary?: SlotBoundaryContext
  private contentCtx?: RenderContext
  // Decoded from VaporSlotFlags: forwarded roots expose their content
  // validity to the enclosing boundary (unless once, whose content never
  // changes validity).
  private readonly notifyParentBoundary: boolean
  constructor(flags: number = 0, adoptAnchor?: Node) {
    super(
      SLOT_FRAGMENT | SLOT_RESOLVER,
      __DEV__ ? 'slot' : undefined,
      false,
      false,
      adoptAnchor,
    )
    // Fallback scopes are detached from content updates, but still belong
    // to the outlet's owner scope.
    onScopeDispose(() => {
      this.disposed = true
      if (this.fallbackScope) this.fallbackScope.stop()
    }, true)
    this.notifyParentBoundary = slotNotifiesBoundary(flags)
  }

  // updateSlot owns hydration timing, so opt out of autoHydrate.
  protected get autoHydrate(): boolean {
    return false
  }

  renderBranch(
    render: BlockFn | undefined,
    transition: VaporTransitionHooks | undefined,
    parent: ParentNode | null,
    key: any,
    noScope: boolean,
    notifyUpdated: boolean,
    removePrevious?: () => void,
    branchKey?: any,
  ): void {
    super.renderBranch(
      render,
      transition,
      parent,
      key,
      noScope,
      notifyUpdated,
      removePrevious,
      branchKey,
    )
    // A deferred branch render (Transition out-in) lands after updateContent
    // captured `content`; re-capture and re-resolve so the exposed block and
    // the fallback decision follow the branch that actually rendered.
    if (!this.isUpdating) {
      this.content = this.nodes
      recheckSlotResolution(this)
    }
  }

  get boundary(): SlotBoundaryContext {
    if (!this.ownBoundary) {
      this.ownBoundary = createSlotBoundary(
        this,
        () => this.localFallback,
        () => markSlotResolutionDirty(this),
        () => isHoldingSlotContent(this),
      )
    }
    return this.ownBoundary
  }

  insert(
    parent: ParentNode,
    anchor: Node | null,
    parentSuspense?: SuspenseBoundary | null,
  ): void {
    this.disposed = false
    placeSlotContent(this, parent, anchor, parentSuspense)
  }

  move(
    parent: ParentNode,
    anchor: Node | null,
    moveType: MoveType,
    parentComponent?: VaporComponentInstance,
    parentSuspense?: SuspenseBoundary | null,
  ): void {
    placeSlotContent(
      this,
      parent,
      anchor,
      parentSuspense,
      moveType,
      parentComponent,
    )
  }

  remove(parent?: ParentNode): void {
    this.disposed = true
    remove(this.content, parent)
    disposeSlotResolution(this, parent)
  }

  // @internal shared with hydrateSlotFragmentContent
  updateContent(render: BlockFn | undefined, key: any): void {
    // update() operates on this.nodes, but while fallback is active `nodes`
    // points at the fallback block. Aim it at the content branch so the base
    // pipeline re-renders content, then capture the result back; the
    // subsequent recheckSlotResolution decides what `nodes` exposes
    // (syncNodes).
    const exposed = this.nodes
    this.nodes = this.content
    this.update(render, key)
    this.content = this.nodes
    // out-in: the leaving fallback stays exposed until its leave ends
    if (isTransitionEnabled && this.held === 'leaving') this.nodes = exposed
  }

  updateSlot(
    render?: BlockFn,
    fallback?: BlockFn,
    key: any = render || fallback,
  ): void {
    this.localFallback = fallback
    const boundary = this.boundary
    // Content renders under the outlet context plus this boundary; both are
    // fixed before the first update.
    const contentCtx = (this.contentCtx ||= deriveSlotBoundary(
      this.ctx,
      boundary,
    ))
    const slotRender = render
      ? () => withRenderContext(contentCtx, render)
      : () => EMPTY_BLOCK
    this.isUpdating = true
    this.pendingRecheck = false

    try {
      if (isHydrating) {
        hydrateSlotFragmentContent(this, slotRender, key)
      } else {
        this.updateContent(slotRender, key)
        recheckSlotResolution(this)
      }
    } finally {
      this.pendingRecheck = false
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
    this.nodes = resolveExposedSlotNodes(this)
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
  if (insertionParent) registerNestedVDOMCleanup(block)
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

/**
 * The key a fragment hands to its branch root as default: a declared key
 * (static key on a dynamic component) or the current branch key (keyed
 * fragment, dynamic component `:key`, v-if branch index).
 */
export function getFragmentKey(frag: VaporFragment): any {
  return frag.$key ?? (frag as DynamicFragment).branchKey
}

export function isForFragment(val: unknown): val is ForFragment {
  return !!(val && (val as any).__vf & FOR)
}

export function isForBlock(val: unknown): val is ForBlock {
  return !!(val && (val as any).__vf & FOR_ITEM)
}

export function isVaporSlotOutlet(val: unknown): val is DynamicFragment {
  return !!(val && (val as any).__vf & SLOT)
}

export function isSlotResolver(val: unknown): val is SlotFragment {
  return !!(val && (val as any).__vf & SLOT_RESOLVER)
}
