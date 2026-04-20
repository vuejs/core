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
  warnExtraneousAttributes,
} from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  applyFallthroughProps,
  isVaporComponent,
} from './component'
import type { NodeRef } from './apiTemplateRef'
import {
  advanceHydrationNode,
  cleanupHydrationTail,
  currentHydrationNode,
  enterHydrationBoundary,
  isComment,
  isHydrating,
  locateEndAnchor,
  locateHydrationBoundaryClose,
  locateHydrationNode,
  locateNextNode,
  markHydrationAnchor,
  setCurrentHydrationNode,
} from './dom/hydration'
import { isArray } from '@vue/shared'
import { renderEffect } from './renderEffect'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots'
import { setBlockKey } from './helpers/setKey'
import {
  type VaporKeepAliveContext,
  currentKeepAliveCtx,
  setCurrentKeepAliveCtx,
  withCurrentCacheKey,
} from './components/KeepAlive'
import { applyTransitionHooks, applyTransitionLeaveHooks } from './transition'

export class VaporFragment<
  T extends Block = Block,
> implements TransitionOptions {
  $key?: any
  $transition?: VaporTransitionHooks | undefined
  nodes: T
  vnode?: VNode | null = null
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
  hydrate?: (...args: any[]) => void
  setRef?: (
    instance: VaporComponentInstance,
    ref: NodeRef,
    refFor: boolean,
    refKey: string | undefined,
  ) => void

  // hooks
  onUpdated?: ((nodes?: Block) => void)[]

  // render context
  readonly renderInstance: GenericComponentInstance | null = currentInstance
  readonly slotOwner: VaporComponentInstance | null = currentSlotOwner
  readonly keepAliveCtx: VaporKeepAliveContext | null = currentKeepAliveCtx
  readonly inheritedSlotBoundary: SlotBoundaryContext | null =
    currentSlotBoundary

  constructor(nodes: T) {
    this.nodes = nodes
  }

  protected runWithRenderCtx<R>(fn: () => R): R {
    const prevInstance = setCurrentInstance(this.renderInstance)
    const prevSlotOwner = setCurrentSlotOwner(this.slotOwner)
    const prevKeepAliveCtx = setCurrentKeepAliveCtx(this.keepAliveCtx)
    const prevBoundary = setCurrentSlotBoundary(this.inheritedSlotBoundary)
    try {
      return fn()
    } finally {
      setCurrentSlotBoundary(prevBoundary)
      setCurrentKeepAliveCtx(prevKeepAliveCtx)
      setCurrentSlotOwner(prevSlotOwner)
      setCurrentInstance(...prevInstance)
    }
  }
}

export class ForFragment extends VaporFragment<Block[]> {
  constructor(nodes: Block[]) {
    super(nodes)
    trackSlotBoundaryDirtying(this)
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
  // @ts-expect-error - assigned in hydrate()
  anchor: Node
  scope: EffectScope | undefined
  current?: BlockFn
  pending?: { render?: BlockFn; key: any }
  anchorLabel?: string
  keyed?: boolean

  // fallthrough attrs
  attrs?: Record<string, any>
  constructor(
    anchorLabel?: string,
    keyed: boolean = false,
    locate: boolean = true,
  ) {
    super([])
    this.keyed = keyed
    if (isHydrating) {
      this.anchorLabel = anchorLabel
      if (locate) locateHydrationNode()
    } else {
      this.anchor =
        __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
      if (__DEV__) this.anchorLabel = anchorLabel
    }
    this.registerSlotBoundaryDirty()
  }

  protected registerSlotBoundaryDirty(): void {
    const boundary = this.inheritedSlotBoundary
    if (!boundary) return
    ;(this.onUpdated || (this.onUpdated = [])).push(() => boundary.markDirty())
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
      // On initial hydration, `key === current` means `render` is empty,
      // so this fragment hydrates as empty content.
      if (isHydrating && this.anchorLabel !== 'slot') this.hydrate(true)
      return
    }

    const transition = this.$transition
    // currently leaving: defer mounting the next branch until
    // the leave finishes.
    if (transition && transition.state.isLeaving) {
      // Track the latest target key immediately so repeated updates during
      // leave keep overwriting the pending branch instead of reviving stale
      // keys when the deferred render finally runs.
      this.current = key
      this.pending = { render, key }
      return
    }

    const instance = currentInstance
    const prevSub = setActiveSub()
    const parent = isHydrating ? null : this.anchor.parentNode
    // teardown previous branch
    if (this.scope) {
      let retainScope = false
      const keepAliveCtx = this.keepAliveCtx

      // if keepAliveCtx exists and processShapeFlag returns a cache key,
      // cache the scope and retain it.
      const cacheKey = keepAliveCtx
        ? this.keyed
          ? withCurrentCacheKey(this.current, () =>
              keepAliveCtx.processShapeFlag(this.nodes),
            )
          : keepAliveCtx.processShapeFlag(this.nodes)
        : false
      if (cacheKey !== false) {
        keepAliveCtx!.cacheScope(cacheKey, this.current, this.scope)
        retainScope = true
      }

      if (!retainScope) {
        this.scope.stop()
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
              this.renderBranch(pending.render, transition, parent, pending.key)
            } else {
              this.renderBranch(render, transition, parent, key)
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

    // A non-slot fragment can render empty first during hydration, then flip
    // to a real branch before hydration exits (for example inside an async
    // component slot). Re-point the cursor at the fragment-owned insertion
    // anchor so the late branch inserts before that anchor instead of
    // consuming trailing hydrated siblings or the enclosing slot boundary.
    if (
      isHydrating &&
      render &&
      this.anchorLabel !== 'slot' &&
      !isValidBlock(this.nodes)
    ) {
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

    this.renderBranch(render, transition, parent, key)
    setActiveSub(prevSub)

    if (isHydrating && this.anchorLabel !== 'slot') {
      this.hydrate(render == null)
    }
  }

  renderBranch(
    render: BlockFn | undefined,
    transition: VaporTransitionHooks | undefined,
    parent: ParentNode | null,
    key: any,
  ): void {
    this.current = key
    if (render) {
      const keepAliveCtx = this.keepAliveCtx
      // try to reuse the kept-alive scope
      const scope = keepAliveCtx && keepAliveCtx.getScope(this.current)
      if (scope) {
        this.scope = scope
      } else {
        this.scope = new EffectScope()
      }

      const renderBranch = () => {
        try {
          this.nodes = this.runWithRenderCtx(
            () => this.scope!.run(render) || [],
          )
        } finally {
          // propagate the fragment key onto freshly rendered nodes.
          const key = this.keyed ? this.current : this.$key
          if (key !== undefined) setBlockKey(this.nodes, key)

          if (transition) {
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
        // apply fallthrough props during update
        if (this.attrs) {
          if (this.nodes instanceof Element) {
            // ensure render effect is cleaned up when scope is stopped
            this.scope.run(() => {
              renderEffect(() =>
                applyFallthroughProps(this.nodes as Element, this.attrs!),
              )
            })
          } else if (
            __DEV__ &&
            // preventing attrs fallthrough on slots
            // consistent with VDOM slots behavior
            (this.anchorLabel === 'slot' ||
              (isArray(this.nodes) && this.nodes.length))
          ) {
            warnExtraneousAttributes(this.attrs)
          }
        }

        insert(this.nodes, parent, this.anchor)

        // For out-in transition, call cacheBlock after renderBranch completes
        // because KeepAlive's onUpdated fires before the deferred rendering finishes
        if (keepAliveCtx && transition && transition.mode === 'out-in') {
          keepAliveCtx.cacheBlock()
        }
      }
    } else {
      this.scope = undefined
      this.nodes = []
    }

    if (parent && this.onUpdated) {
      this.onUpdated.forEach(hook => hook(this.nodes))
    }
  }

  hydrate = (isEmpty = false, isSlot = false): void => {
    // early return allows tree-shaking of hydration logic when not used
    if (!isHydrating) return

    let advanceAfterRestore: Node | null = null
    let exitHydrationBoundary: (() => void) | undefined

    try {
      // reuse `<!---->` as anchor
      // `<div v-if="false"></div>` -> `<!---->`
      if (isEmpty) {
        if (isComment(currentHydrationNode!, '')) {
          this.anchor = markHydrationAnchor(currentHydrationNode!)
          advanceHydrationNode(currentHydrationNode)
          return
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
        this.anchor = markHydrationAnchor(this.nodes)
        this.nodes = []
        const needsCleanup = currentHydrationNode !== this.anchor
        if (needsCleanup) {
          exitHydrationBoundary = enterHydrationBoundary(this.anchor)
          advanceAfterRestore = this.anchor
        } else {
          advanceHydrationNode(this.anchor)
        }
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
        const nextNode = locateNextNode(currentHydrationNode)
        if (parentNode) {
          this.nodes = []
          if (nextNode) {
            exitHydrationBoundary = enterHydrationBoundary(nextNode)
          } else {
            cleanupHydrationTail(currentHydrationNode)
            setCurrentHydrationNode(null)
          }
          queuePostFlushCb(() => {
            parentNode.insertBefore(
              (this.anchor = markHydrationAnchor(
                __DEV__ ? createComment(this.anchorLabel!) : createTextNode(),
              )),
              nextNode,
            )
          })
          return
        }
      }

      // Slot fallback can fall through an inner `v-if`. When the `if` resolves
      // to an invalid block and the fallback is selected, the `if` still needs
      // its own runtime anchor instead of reusing the parent slot's end anchor.
      const currentSlotEndAnchor = getCurrentSlotEndAnchor()
      if (
        this.anchorLabel === 'if' &&
        currentSlotEndAnchor &&
        isHydratingSlotFallbackActive() &&
        !isValidBlock(this.nodes)
      ) {
        const endAnchor = currentSlotEndAnchor
        queuePostFlushCb(() => {
          const parentNode = endAnchor.parentNode
          if (!parentNode) return
          parentNode.insertBefore(
            (this.anchor = markHydrationAnchor(
              __DEV__ ? createComment(this.anchorLabel!) : createTextNode(),
            )),
            endAnchor,
          )
        })
        return
      }

      const forwardedSlot = (this as any as SlotFragment).forwarded
      const slotAnchor = isSlot ? currentSlotEndAnchor : null
      // Reuse SSR `<!--]-->` as anchor.
      // SSR wraps slots and multi-root `v-if` branches with `<!--[-->...<!--]-->`.
      // Non-forwarded slots always own the closing `<!--]-->`, even when empty.
      // Forwarded slots only own it when they rendered valid content.
      if (
        (isSlot && (!forwardedSlot || isValidBlock(this.nodes))) ||
        (this.anchorLabel === 'if' &&
          isArray(this.nodes) &&
          this.nodes.length > 1)
      ) {
        const anchor = locateHydrationBoundaryClose(
          slotAnchor || currentHydrationNode!,
          slotAnchor || null,
        )
        if (isComment(anchor!, ']')) {
          this.anchor = markHydrationAnchor(anchor)
          exitHydrationBoundary = enterHydrationBoundary(anchor)
          advanceHydrationNode(anchor)
          return
        } else if (__DEV__) {
          throw new Error(
            `Failed to locate ${this.anchorLabel} fragment anchor. this is likely a Vue internal bug.`,
          )
        }
      }

      // Otherwise, create a new anchor.
      // This covers: empty forwarded slots, dynamic-component,
      // async component, keyed fragment.
      let parentNode: Node | null
      let nextNode: Node | null
      if (forwardedSlot) {
        // Keep the forwarded slot close marker structural for parent cleanup,
        // even though this fragment uses a runtime anchor after it.
        const anchor = markHydrationAnchor(slotAnchor!)
        parentNode = anchor.parentNode
        nextNode = anchor.nextSibling
      } else {
        const node = findBlockNode(this.nodes)
        parentNode = node.parentNode
        nextNode = node.nextNode
      }

      // Assign `this.anchor` only after the anchor is inserted.
      // Otherwise detached anchors could be observed too early by traversal
      // logic such as `findLastChild()`.
      queuePostFlushCb(() => {
        const anchor =
          nextNode && nextNode.parentNode === parentNode ? nextNode : null
        parentNode!.insertBefore(
          (this.anchor = markHydrationAnchor(
            __DEV__ ? createComment(this.anchorLabel!) : createTextNode(),
          )),
          anchor,
        )
      })
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
  getLocalFallback: () => BlockFn | undefined
  markDirty: () => void
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

const slotFallbackBoundaryCache = new WeakMap<
  SlotBoundaryContext,
  SlotBoundaryContext
>()

// Render a fallback body on behalf of `boundary`.
// Nested slots inside the fallback must look up from the grandparent to avoid
// fallback -> <slot> -> same fallback recursion, but dirty notifications from
// dynamic children must still reach the owning boundary so the slot can
// re-check its effective output when the fallback becomes valid/invalid.
export function withSlotFallbackBoundary<R>(
  boundary: SlotBoundaryContext,
  fn: () => R,
): R {
  let fallbackBoundary = slotFallbackBoundaryCache.get(boundary)
  if (!fallbackBoundary) {
    slotFallbackBoundaryCache.set(
      boundary,
      (fallbackBoundary = {
        get parent() {
          return boundary.parent
        },
        getLocalFallback: () => undefined,
        markDirty: () => boundary.markDirty(),
      }),
    )
  }
  return withOwnedSlotBoundary(fallbackBoundary, fn)
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

function hasSlotFallback(
  boundary: SlotBoundaryContext | null | undefined,
): boolean {
  while (boundary) {
    if (boundary.getLocalFallback()) {
      return true
    }
    boundary = boundary.parent
  }
  return false
}

export function renderSlotFallback(
  boundary: SlotBoundaryContext | null | undefined,
  ...args: any[]
): Block | undefined {
  const [block, hasFallback] = renderSlotFallbackBlock(boundary || null, args)
  return hasFallback ? block : undefined
}

function renderSlotFallbackBlock(
  boundary: SlotBoundaryContext | null,
  args: any[],
): [Block, boolean] {
  if (!boundary) {
    return [[], false]
  }

  const localFallback = boundary.getLocalFallback()
  if (!localFallback) {
    return renderSlotFallbackBlock(boundary.parent, args)
  }

  const local = withSlotFallbackBoundary(boundary, () => localFallback(...args))
  if (isValidBlock(local)) {
    return [local, true]
  }

  const [inherited] = renderSlotFallbackBlock(boundary.parent, args)
  return [
    resolveSlotFallbackCarrierOwner(local) ? [inherited, local] : inherited,
    true,
  ]
}

export interface SlotFallbackControllerHost {
  getParentBoundary: () => SlotBoundaryContext | null
  getLocalFallback: () => BlockFn | undefined
  getContent: () => Block
  getParentNode: () => ParentNode | null
  getAnchor: () => Node | null
  runWithRenderCtx: <R>(fn: () => R) => R
  isBusy?: () => boolean
  isDisposed?: () => boolean
  onValidityChange: () => void
  // Interop-only hooks:
  // - plain SlotFragment validity is just `isValidBlock(getContent())`
  // - plain SlotFragment consumes pending rechecks itself in updateSlot(), so it
  //   opts out of the controller's post-fallback same-stack rerun
  isContentValid?: () => boolean
  rerunRecheckAfterFallbackRender?: boolean
  syncEffectiveOutput?: () => void
}

export class SlotFallbackController {
  private activeFallback: Block | null = null
  private fallbackScope: EffectScope | undefined
  private pendingRecheck = false
  private isRenderingFallback = false
  private readonly rerunRecheckAfterFallbackRender: boolean

  readonly boundary: SlotBoundaryContext

  constructor(private readonly host: SlotFallbackControllerHost) {
    this.rerunRecheckAfterFallbackRender =
      host.rerunRecheckAfterFallbackRender !== false
    this.boundary = {
      get parent() {
        return host.getParentBoundary()
      },
      getLocalFallback: host.getLocalFallback,
      markDirty: () => {
        if (host.isDisposed && host.isDisposed()) {
          return
        }
        if (this.isRenderingFallback) {
          if (isHydrating) {
            this.pendingRecheck = true
          }
          return
        }
        if (host.isBusy && host.isBusy()) {
          this.pendingRecheck = true
          return
        }
        this.recheck(true)
      },
    }
  }

  getEffectiveOutput(): Block {
    return this.activeFallback || this.host.getContent()
  }

  getActiveFallback(): Block | null {
    return this.activeFallback
  }

  hasFallback(): boolean {
    return hasSlotFallback(this.boundary)
  }

  wrapFallback(fallback: BlockFn): BlockFn {
    return (...args: any[]) =>
      // Wrapped fallbacks can be invoked later under another owner's render
      // path, so re-establish this boundary before resolving local fallback.
      this.host.runWithRenderCtx(() =>
        withSlotFallbackBoundary(this.boundary, () => fallback(...args)),
      )
  }

  clearPendingRecheck(): void {
    this.pendingRecheck = false
  }

  takePendingRecheck(): boolean {
    const shouldRecheck = this.pendingRecheck
    this.pendingRecheck = false
    return shouldRecheck
  }

  dispose(): void {
    this.clearActiveFallback()
    this.pendingRecheck = false
  }

  relocate(): void {
    if (isHydrating || !this.activeFallback) {
      return
    }
    const parentNode = this.host.getParentNode()
    if (!parentNode) {
      return
    }
    const carrierAnchor = findFirstSlotFallbackCarrierNode(
      this.host.getContent(),
    )
    insert(
      this.activeFallback,
      parentNode,
      carrierAnchor && carrierAnchor.parentNode === parentNode
        ? carrierAnchor
        : this.host.getAnchor(),
    )
  }

  syncActiveFallback(): void {
    if (!this.activeFallback) {
      return
    }
    const activeFallback = this.activeFallback
    queuePostFlushCb(() => {
      this.syncActiveFallbackOrder(activeFallback)
    })
  }

  recheck(force: boolean = false): void {
    const prevValid = this.activeFallback
      ? isValidBlock(this.activeFallback)
      : this.isContentValid()
    const contentValid = this.isContentValid()

    if (contentValid) {
      this.clearActiveFallback()
    } else if (!this.ensureFallback(force)) {
      this.clearActiveFallback()
    }

    const nextValid = this.activeFallback
      ? isValidBlock(this.activeFallback)
      : this.isContentValid()
    if (this.host.syncEffectiveOutput) {
      this.host.syncEffectiveOutput()
    }
    if (prevValid !== nextValid) {
      this.host.onValidityChange()
    }
  }

  private isContentValid(): boolean {
    return this.host.isContentValid
      ? this.host.isContentValid()
      : isValidBlock(this.host.getContent())
  }

  private clearActiveFallback(): void {
    if (this.activeFallback) {
      const parentNode = this.host.getParentNode()
      if (parentNode) {
        remove(this.activeFallback, parentNode)
      }
      this.activeFallback = null
    }
    if (this.fallbackScope) {
      this.fallbackScope.stop()
      this.fallbackScope = undefined
    }
  }

  private ensureFallback(force: boolean): boolean {
    if (force) {
      this.clearActiveFallback()
    }
    if (this.activeFallback) return true

    const scope = new EffectScope()
    let renderedFallback: Block | undefined
    this.isRenderingFallback = true
    try {
      renderedFallback =
        this.host.runWithRenderCtx(
          () => scope.run(() => renderSlotFallback(this.boundary)) || undefined,
        ) || undefined
    } catch (err) {
      scope.stop()
      throw err
    } finally {
      this.isRenderingFallback = false
    }
    if (!renderedFallback) {
      scope.stop()
      return false
    }

    this.fallbackScope = scope
    this.activeFallback = renderedFallback
    this.ensureActiveFallbackOrderHook(renderedFallback)
    if (this.pendingRecheck && this.rerunRecheckAfterFallbackRender) {
      this.pendingRecheck = false
      this.recheck(true)
      return true
    }

    this.relocate()
    return true
  }
  private syncActiveFallbackOrder(block: Block): void {
    if (!isFragment(block) || !isArray(block.nodes) || block.nodes.length < 2) {
      return
    }

    const carrierNodes = collectBlockNodes(this.host.getContent(), [], true)
    const lastNode = block.nodes[block.nodes.length - 1]
    if (
      !carrierNodes.length ||
      !(lastNode instanceof Node) ||
      lastNode instanceof Comment
    ) {
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

  private ensureActiveFallbackOrderHook(block: Block): void {
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
      this.syncActiveFallbackOrder(fragment),
    )
    fragment.hasSlotFallbackOrderHook = true
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

export class SlotFragment extends DynamicFragment {
  forwarded = false
  parentSlotBoundary: SlotBoundaryContext | null = getCurrentSlotBoundary()
  private localFallback?: BlockFn
  private isUpdatingSlot = false
  private readonly controller: SlotFallbackController
  readonly slotFallbackBoundary: SlotBoundaryContext

  constructor() {
    super(isHydrating || __DEV__ ? 'slot' : undefined, false, false)
    this.controller = new SlotFallbackController({
      getParentBoundary: () => this.parentSlotBoundary,
      getLocalFallback: () => this.localFallback,
      getContent: () => this.nodes,
      getParentNode: () => (this.anchor ? this.anchor.parentNode : null),
      getAnchor: () => this.anchor || null,
      runWithRenderCtx: fn => this.runWithRenderCtx(fn),
      isBusy: () => this.isUpdatingSlot,
      rerunRecheckAfterFallbackRender: false,
      onValidityChange: () => {
        if (this.parentSlotBoundary) {
          this.parentSlotBoundary.markDirty()
        }
      },
    })
    this.slotFallbackBoundary = this.controller.boundary
    if (!isHydrating) {
      this.insert = (parent, anchor) => this.insertSlot(parent, anchor)
    }
    this.remove = parent => this.removeSlot(parent)
  }

  // SlotFragment propagates dirty selectively via recheck() (only when
  // validity flips), so skip the default auto-register from DynamicFragment.
  protected registerSlotBoundaryDirty(): void {}

  get fallbackBlock(): Block | null {
    return this.controller.getActiveFallback()
  }

  getEffectiveOutput(): Block {
    return this.controller.getEffectiveOutput()
  }

  private insertSlot(parent: ParentNode, anchor: Node | null): void {
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
    if (this.fallbackBlock) {
      mutateSlotFallbackCarrier(this.nodes, block => remove(block, parent))
    } else {
      remove(this.nodes, parent)
    }
    this.controller.dispose()
  }

  updateSlot(
    render?: BlockFn,
    fallback?: BlockFn,
    key: any = render || fallback,
  ): void {
    const prevLocalFallback = this.localFallback
    this.localFallback = fallback
    const fallbackChanged = prevLocalFallback !== fallback
    const slotRender = render
      ? () => withOwnedSlotBoundary(this.slotFallbackBoundary, render)
      : () => []
    const slotKey = key === undefined ? slotRender : key
    this.isUpdatingSlot = true
    this.controller.clearPendingRecheck()

    try {
      const shouldForce =
        fallbackChanged || this.controller.takePendingRecheck()
      if (isHydrating) {
        withHydratingSlotBoundary(() => {
          const prev = isHydratingSlotFallbackActive()
          try {
            if (this.controller.hasFallback()) {
              setCurrentHydratingSlotFallbackActive(true)
            }
            this.update(slotRender, slotKey)
            const contentValid = isValidBlock(this.nodes)
            this.controller.recheck(shouldForce)
            // Updates run under the temporary fallback-active marker so empty
            // inner branches can materialize their own anchors if fallback
            // takes over. If recheck resolves back to content, restore the
            // outer state before hydrate(); the surrounding finally still
            // restores nested callers when we leave this boundary.
            if (!this.controller.hasFallback() || contentValid) {
              setCurrentHydratingSlotFallbackActive(prev)
            }
            this.hydrate(!isValidBlock(this.getEffectiveOutput()), true)
          } finally {
            setCurrentHydratingSlotFallbackActive(prev)
          }
        })
      } else {
        this.update(slotRender, slotKey)
        this.controller.recheck(shouldForce)
      }
    } finally {
      this.controller.clearPendingRecheck()
      this.isUpdatingSlot = false
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
