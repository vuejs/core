import { EffectScope, onScopeDispose } from '@vue/reactivity'
import {
  type GenericComponentInstance,
  type SuspenseBoundary,
  type SuspenseProps,
  assertNumber,
  collectDeferredEnters,
  discardSuspenseEffects,
  findPendingAncestor,
  queuePostFlushCb,
  registerSuspenseDep,
  releaseSuspenseEffects,
} from '@vue/runtime-dom'
import { isArray, isFunction, toNumber } from '@vue/shared'
import {
  type DefineVaporComponent,
  defineVaporComponent,
} from '../apiDefineComponent'
import {
  type Block,
  type BlockFn,
  EMPTY_BLOCK,
  type TransitionBlock,
  insert,
  remove,
} from '../block'
import type { StaticSlots } from '../componentSlots'
import {
  type DetachedBranch,
  DynamicFragment,
  isDynamicFragment,
} from '../fragment'
import { SLOT } from '../fragmentFlags'
import { createElement, isCommentNode, isElementNode } from '../dom/node'
import { isHydrating } from '../dom/hydrationState'
import { hydrateSlotContent } from '../dom/hydrateFragment'
import {
  currentRenderContext,
  deriveRenderContext,
  withRenderContext,
} from '../renderContext'
import { takeDeferredEnters, withSuspenseEnabled } from '../suspense'
import { isTransitionEnabled } from '../transition'
import { isInteropEnabled } from '../vdomInteropState'

// incrementing unique id for every pending cycle of a Vapor boundary
let suspenseId = 0

// the branches of the boundary's own fragment
const CONTENT = 1
const FALLBACK = 2

// the root fragment's branch while a timeout shows the fallback in its place
const ROOT_FALLBACK = Symbol()

const EMPTY_BRANCH: DetachedBranch = { nodes: EMPTY_BLOCK, scope: undefined }

/**
 * The boundary of a `<Suspense>` in a Vapor template. A component created in
 * its content registers its async setup with it (`registerDep`), and the
 * content mounts in a hidden container until every such setup has settled.
 * The fallback shows while the first content waits. A branch switch of the
 * content's root fragment (`v-if`, `:key`, `<component :is>`) renders the next
 * branch in the hidden container and keeps the current one until the next one
 * is ready, as the vdom boundary does for a new root vnode.
 *
 * It has the fields of a vdom `SuspenseBoundary` that the code rendering
 * under a boundary reads, so the Vapor and the vdom components in its content
 * (through the interop) take it as their parent suspense.
 */
export class VaporSuspenseBoundary {
  readonly parent: SuspenseBoundary | null
  hiddenContainer: ParentNode = createElement('div')
  deps = 0
  pendingId: number = suspenseId++
  effects: Function[] = []
  // set while a branch waits for its async deps
  pendingBranch: DetachedBranch | null = null
  isInFallback = false
  isHydrating: boolean
  isUnmounted = false
  timeout: number
  timeoutTimer: ReturnType<typeof setTimeout> | undefined

  // what the component renders: the content, or the fallback while the first
  // content waits
  readonly frag: DynamicFragment
  // the content, until the fragment shows it
  private content: DetachedBranch | undefined
  // the content's root fragment, if it has one
  private root: DynamicFragment | undefined
  // the key of the root's branch on screen
  private activeKey: any
  // the root switch that waits: its key and branch key
  private pendingKey: any
  private pendingBranchKey: any
  // the pending cycle of the parent boundary that counts this one as a dep
  private parentSuspenseId: number | undefined

  constructor(
    private readonly props: SuspenseProps,
    private readonly slots: StaticSlots,
  ) {
    const ctx = currentRenderContext
    const parent = (this.parent = ctx.suspense)
    this.isHydrating = isHydrating
    const timeout = props.timeout != null ? toNumber(props.timeout) : undefined
    if (__DEV__) assertNumber(timeout, `Suspense timeout`)
    this.timeout = typeof timeout === 'number' ? timeout : -1
    if (isSuspensible(props) && parent && parent.pendingBranch) {
      this.parentSuspenseId = parent.pendingId
      parent.deps++
    }
    // it owns the SSR range of the content, as a slot outlet does
    this.frag = new DynamicFragment(SLOT, __DEV__ ? 'suspense' : undefined)
    // the content is no part of an enclosing slot: its root reports to no
    // slot outlet
    const contentCtx = deriveRenderContext(
      ctx,
      ctx.slotOwner,
      null,
      ctx.slotScopeIds,
      this.asParentSuspense(),
    )
    const renderContent = () =>
      withRenderContext(contentCtx, () =>
        slots.default ? slots.default() : EMPTY_BLOCK,
      )
    onScopeDispose(() => this.unmount())

    // a marker until the content is rendered: only truthiness is read
    this.pendingBranch = { nodes: EMPTY_BLOCK, scope: undefined }
    if (isHydrating) {
      // the server rendered the content: it hydrates in place
      hydrateSlotContent(this.frag, renderContent, CONTENT)
      this.pendingBranch = { nodes: this.frag.nodes, scope: this.frag.scope }
      this.findRoot(this.frag.nodes)
      if (this.deps === 0) this.resolve(false, true)
      return
    }
    const scope = new EffectScope()
    const nodes = scope.run(renderContent)!
    this.content = this.pendingBranch = { nodes, scope }
    // the content mounts off the DOM, and its async setups register
    insert(nodes, this.hiddenContainer, null, this.asParentSuspense())
    this.findRoot(nodes)
    if (this.deps > 0) {
      this.emit('onPending')
      this.emit('onFallback')
      this.isInFallback = true
      this.frag.current = FALLBACK
      this.frag.swapBranch(
        this.frag.renderDetached(this.renderFallback),
        FALLBACK,
      )
    } else {
      this.resolve(false, true)
    }
  }

  /**
   * The boundary as the shared code types it: that code reads only the fields
   * declared above.
   */
  asParentSuspense(): SuspenseBoundary {
    return this as unknown as SuspenseBoundary
  }

  private renderFallback: BlockFn = () =>
    this.slots.fallback ? this.slots.fallback() : EMPTY_BLOCK

  private emit(name: 'onResolve' | 'onPending' | 'onFallback'): void {
    const handler = this.props[name]
    if (isFunction(handler)) handler()
  }

  // vdom takes the single root vnode of the slot; comments do not count
  private findRoot(block: Block): void {
    if (isArray(block)) {
      const roots = block.filter(b => !isCommentNode(b))
      if (roots.length !== 1) return
      block = roots[0]
    }
    if (isDynamicFragment(block) && !(block.__vf & SLOT)) {
      this.root = block
      this.activeKey = block.current
      block.suspenseRoot = this
    }
  }

  registerDep(
    instance: GenericComponentInstance,
    onResolve: (setupResult: unknown) => void,
  ): void {
    registerSuspenseDep(this.asParentSuspense(), instance, onResolve)
  }

  /**
   * A branch switch of the content's root fragment, the counterpart of
   * vdom's `patchSuspense` for a new root vnode.
   */
  switchBranch(
    render: BlockFn | undefined,
    key: any,
    noScope: boolean,
    branchKey: any,
  ): void {
    const root = this.root!
    root.current = key
    if (this.pendingBranch) {
      // toggled before the pending branch resolved: that cycle is over
      this.pendingId = suspenseId++
      this.deps = 0
      if (this.isHydrating) {
        // the adopted DOM stays on screen until the new branch is ready
        this.isHydrating = false
        discardSuspenseEffects(this.asParentSuspense())
        this.hiddenContainer = createElement('div')
        if (root.scope) root.scope.pause()
      } else if (this.content) {
        // the first content still waits, in the hidden container: the root
        // takes the new branch there, and the content waits for it
        root.swapBranch(EMPTY_BRANCH, key, branchKey)
        discardSuspenseEffects(this.asParentSuspense())
        root.swapBranch(root.renderDetached(render, noScope), key, branchKey)
        if (this.deps <= 0) this.resolve()
        return
      } else {
        this.discardPending()
        if (!this.isInFallback && key === this.activeKey) {
          // toggled back to the branch on screen
          if (root.scope) root.scope.resume()
          this.resolve(true)
          return
        }
      }
    } else {
      this.emit('onPending')
      this.pendingId = suspenseId++
      // the branch on screen takes no updates from the parent until the next
      // one resolves, or a toggle brings it back
      if (root.scope) root.scope.pause()
    }
    this.pendingKey = key
    this.pendingBranchKey = branchKey
    // a marker while the branch renders: its effects wait for the resolve
    this.pendingBranch = { nodes: EMPTY_BLOCK, scope: undefined }
    const branch = root.renderDetached(render, noScope)
    this.pendingBranch = branch
    insert(branch.nodes, this.hiddenContainer, null, this.asParentSuspense())
    if (this.deps <= 0) {
      this.resolve()
    } else if (!this.isInFallback) {
      const { timeout } = this
      if (timeout > 0) {
        // the timer belongs to the pending round: another switch while
        // pending keeps it counting
        if (!this.timeoutTimer) {
          this.timeoutTimer = setTimeout(() => {
            this.timeoutTimer = undefined
            this.fallback()
          }, timeout)
        }
      } else if (timeout === 0) {
        this.fallback()
      }
    }
  }

  // the root switch that waits is thrown away, with what it buffered
  private discardPending(): void {
    const pending = this.pendingBranch
    if (pending) {
      if (pending.scope) pending.scope.stop()
      remove(pending.nodes, this.hiddenContainer)
    }
    discardSuspenseEffects(this.asParentSuspense())
    this.hiddenContainer = createElement('div')
  }

  // a root switch waits longer than the timeout: the fallback replaces the
  // root's branch on screen
  private fallback(): void {
    if (this.isUnmounted || !this.pendingBranch || this.isInFallback) return
    this.emit('onFallback')
    this.isInFallback = true
    const root = this.root!
    const current = root.current
    // rendered under the context of the component, so the fallback's effects
    // run now
    root.swapBranch(
      this.frag.renderDetached(this.renderFallback),
      ROOT_FALLBACK,
    )
    root.current = current
    this.activeKey = ROOT_FALLBACK
  }

  // An element mounted while the branch was pending skipped its enter. A root
  // of the branch enters when it moves into place; one inside an element
  // enters here: beforeEnter before the move, enter in the post flush ahead of
  // the buffered effects, as vdom's reveal does.
  private enterDeferred(): void {
    const targets = takeDeferredEnters(this.asParentSuspense())
    if (!targets) return
    const container = this.hiddenContainer
    const enters: Function[] = []
    for (const target of targets) {
      if (isElementNode(target)) {
        const transition = (target as TransitionBlock).$transition
        if (
          transition &&
          !transition.persisted &&
          target.parentNode !== container &&
          container.contains(target)
        ) {
          transition.beforeEnter(target)
          enters.push(() => transition.enter(target))
        }
      } else if (isInteropEnabled) {
        const vnode = target.vnode
        const el = vnode && (vnode.el as Node | null)
        if (el && container.contains(el)) {
          collectDeferredEnters(vnode!, enters, el.parentNode === container)
        }
      }
    }
    if (enters.length) queuePostFlushCb(enters)
  }

  resolve(resume = false, sync = false): void {
    const pending = this.pendingBranch
    if (__DEV__) {
      if (!resume && !pending) {
        throw new Error(
          `suspense.resolve() is called without a pending branch.`,
        )
      }
      if (this.isUnmounted) {
        throw new Error(
          `suspense.resolve() is called on an already unmounted suspense boundary.`,
        )
      }
    }
    const pendingAncestor = findPendingAncestor(this.asParentSuspense())
    if (this.isHydrating) {
      this.isHydrating = false
    } else if (!resume) {
      if (isTransitionEnabled) this.enterDeferred()
      // the branch on screen goes, and its unmount hooks wait with the
      // effects of the new branch, as in vdom
      const content = this.content
      if (content) {
        this.content = undefined
        this.frag.current = CONTENT
        this.frag.swapBranch(content, CONTENT)
      } else {
        const root = this.root!
        root.swapBranch(pending!, this.pendingKey, this.pendingBranchKey)
        this.activeKey = this.pendingKey
      }
    }

    clearTimeout(this.timeoutTimer)
    this.timeoutTimer = undefined
    this.pendingBranch = null
    this.isInFallback = false
    releaseSuspenseEffects(this.effects, pendingAncestor, false)
    this.effects = []

    const parent = this.parent
    if (
      this.parentSuspenseId !== undefined &&
      parent &&
      parent.pendingBranch &&
      this.parentSuspenseId === parent.pendingId
    ) {
      this.parentSuspenseId = undefined
      if (--parent.deps === 0 && !sync) parent.resolve()
    }
    this.emit('onResolve')
  }

  private unmount(): void {
    this.isUnmounted = true
    clearTimeout(this.timeoutTimer)
    this.timeoutTimer = undefined
    const parent = this.parent
    if (this.parentSuspenseId !== undefined && parent) {
      // after the flush, so that async deps of the same update register first
      const pendingId = this.parentSuspenseId
      this.parentSuspenseId = undefined
      queuePostFlushCb(() => {
        if (
          parent.pendingId === pendingId &&
          !parent.isUnmounted &&
          --parent.deps === 0
        ) {
          parent.resolve()
        }
      })
    }
    if (this.pendingBranch) {
      // never revealed: its post jobs go with the ones it buffered, as on a
      // discard before the resolve. Adopted DOM goes with the fragment.
      const content = this.content
      if (content) {
        this.content = undefined
        content.scope!.stop()
        remove(content.nodes, this.hiddenContainer)
        discardSuspenseEffects(this.asParentSuspense())
      } else if (this.isHydrating) {
        discardSuspenseEffects(this.asParentSuspense())
      } else {
        this.discardPending()
      }
    }
  }
}

function isSuspensible(props: SuspenseProps): boolean {
  const suspensible = props.suspensible
  return suspensible != null && suspensible !== false
}

const VaporSuspenseImpl = defineVaporComponent({
  name: 'VaporSuspense',
  __isSuspense: true,
  // vdom drops the attrs of a Suspense vnode
  inheritAttrs: false,
  props: {
    timeout: [String, Number],
    suspensible: { type: Boolean, default: undefined },
    onResolve: Function,
    onPending: Function,
    onFallback: Function,
  },
  setup(props: SuspenseProps, { slots }) {
    return new VaporSuspenseBoundary(props, slots).frag
  },
})

export const VaporSuspense: DefineVaporComponent<{}, string, SuspenseProps> =
  /*@__PURE__*/ withSuspenseEnabled(VaporSuspenseImpl)
