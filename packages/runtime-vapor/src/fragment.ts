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
  remove,
} from './block'
import {
  type GenericComponentInstance,
  type TransitionHooks,
  type VNode,
  currentInstance,
  setCurrentInstance,
} from '@vue/runtime-dom'
import type { VaporComponentInstance } from './component'
import type { NodeRef } from './apiTemplateRef'
import { isHydrating, locateHydrationNode } from './dom/hydration'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots'
import {
  type SlotBoundaryContext,
  currentSlotBoundary,
  getCurrentSlotBoundary,
  hasSlotFallback,
  setCurrentSlotBoundary,
  trackSlotBoundaryDirtying,
  withOwnedSlotBoundary,
} from './slotBoundary'
import {
  hydrateDynamicFragmentAnchor,
  isHydratingSlotFallbackActive,
  prepareDeferredHydrationAnchor,
  setCurrentHydratingSlotFallbackActive,
  withHydratingSlotBoundary,
} from './dom/hydrateFragment'
import {
  type SlotFallbackState,
  disposeSlotFallback,
  markSlotFallbackDirty,
  recheckSlotFallback,
} from './slotFragment'
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
  deferBranchUpdateDuringLeave,
  isTransitionEnabled,
  isVaporTransition,
  removeBranchWithLeave,
} from './transition'

export class VaporFragment<
  T extends Block = Block,
> implements TransitionOptions {
  /**
   * @internal marker for duck typing to avoid direct instanceof check
   * which prevents tree-shaking of VaporFragment
   */
  readonly __vf = true
  $key?: any
  $transition?: VaporTransitionHooks | undefined
  nodes: T
  vnode?: VNode | null
  anchor?: Node
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
    try {
      return runWithFragmentCtx(this, fn)
    } finally {
      setCurrentInstance(...prevInstance)
    }
  }
}

export function runWithFragmentCtx<R>(fragment: VaporFragment, fn: () => R): R {
  const keepAliveCtx = isKeepAliveEnabled ? fragment.keepAliveCtx || null : null
  // When ambient fragment context already matches, no ambient state needs
  // restoring. This keeps ordinary branch renders on the cheap path.
  if (
    currentSlotOwner === fragment.slotOwner &&
    currentSlotBoundary === fragment.inheritedSlotBoundary &&
    (!isKeepAliveEnabled || currentKeepAliveCtx === keepAliveCtx)
  ) {
    return fn()
  }

  const prevSlotOwner = setCurrentSlotOwner(fragment.slotOwner)
  let prevKeepAliveCtx: VaporKeepAliveContext | null = null
  if (isKeepAliveEnabled) {
    prevKeepAliveCtx = setCurrentKeepAliveCtx(keepAliveCtx)
  }
  const prevBoundary = setCurrentSlotBoundary(fragment.inheritedSlotBoundary)
  try {
    return fn()
  } finally {
    setCurrentSlotBoundary(prevBoundary)
    if (isKeepAliveEnabled) {
      setCurrentKeepAliveCtx(prevKeepAliveCtx)
    }
    setCurrentSlotOwner(prevSlotOwner)
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

export class DynamicFragment extends VaporFragment {
  /**
   * @internal marker for duck typing to avoid direct instanceof check
   * which prevents tree-shaking of DynamicFragment
   */
  readonly __df = true
  // @ts-expect-error - assigned in the constructor or hydrateDynamicFragmentAnchor()
  anchor: Node
  scope: EffectScope | undefined
  current?: BlockFn
  // Owned by the Transition module (deferBranchUpdateDuringLeave /
  // removeBranchWithLeave); the core update pipeline never touches it.
  pending?: { render?: BlockFn; key: any; noScope: boolean }
  anchorLabel?: string
  keyed?: boolean
  isSlot?: boolean
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
      if (isHydrating && !this.isSlot) hydrateDynamicFragmentAnchor(this, true)
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
    const parent = !isHydrating && shouldInsert ? this.anchor.parentNode : null
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
      if (
        transition &&
        removeBranchWithLeave(this, transition, parent, render, key, noScope)
      ) {
        // out-in: the next branch mounts after the leave finishes.
        setActiveSub(prevSub)
        return
      }
      parent && remove(this.nodes, parent)
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
      wasMounted || !!parent,
    )
    setActiveSub(prevSub)

    if (isHydrating && !this.isSlot && !reusingDeferredAnchor) {
      hydrateDynamicFragmentAnchor(this, render == null)
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
}

// SlotFragment must live in the same module as DynamicFragment: `extends`
// reads the base class binding at module evaluation time, and fragment.ts
// sits inside a module cycle, so hoisting the class into another module can
// hit the base class before it is initialized depending on entry order.
export class SlotFragment extends DynamicFragment implements SlotFallbackState {
  isSlot = true
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
  }

  updateSlot(
    render?: BlockFn,
    fallback?: BlockFn,
    key: any = render || fallback,
  ): void {
    const prevLocalFallback = this.localFallback
    this.localFallback = fallback
    const boundary = this.slotFallbackBoundary
    const slotRender = render
      ? () => withOwnedSlotBoundary(boundary, render)
      : () => EMPTY_BLOCK
    this.isUpdatingSlot = true
    this.pendingRecheck = false

    try {
      const shouldForce = prevLocalFallback !== fallback
      if (isHydrating) {
        withHydratingSlotBoundary(() => {
          const prev = isHydratingSlotFallbackActive()
          try {
            if (hasSlotFallback(boundary)) {
              setCurrentHydratingSlotFallbackActive(true)
            }
            this.updateContent(slotRender, key)
            const contentValid = isValidBlock(this.content)
            recheckSlotFallback(this, shouldForce)
            // Updates run under the temporary fallback-active marker so empty
            // inner branches can materialize their own anchors if fallback
            // takes over. If recheck resolves back to content, restore the
            // outer state before hydrateDynamicFragmentAnchor(); the surrounding
            // finally still restores nested callers when we leave this
            // boundary.
            if (!hasSlotFallback(boundary) || contentValid) {
              setCurrentHydratingSlotFallbackActive(prev)
            }
            hydrateDynamicFragmentAnchor(this, !isValidBlock(this.nodes))
          } finally {
            setCurrentHydratingSlotFallbackActive(prev)
          }
        })
      } else {
        this.updateContent(slotRender, key)
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

export function isFragment(val: unknown): val is VaporFragment {
  return !!(val && (val as any).__vf)
}

export type InteropFragment<T extends Block = Block> = VaporFragment<T> & {
  vnode: VNode | null
}

export function isInteropFragment(val: unknown): val is InteropFragment {
  return isFragment(val) && val.vnode !== undefined
}

export function isDynamicFragment(val: unknown): val is DynamicFragment {
  return !!(val && (val as any).__df)
}

export function isSlotFragment(val: unknown): val is SlotFragment {
  return isDynamicFragment(val) && !!val.isSlot
}
