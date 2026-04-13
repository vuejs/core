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
  fallback?: BlockFn
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
  readonly slotOwner: VaporComponentInstance | null = currentSlotOwner
  readonly keepAliveCtx: VaporKeepAliveContext | null = currentKeepAliveCtx

  constructor(nodes: T) {
    this.nodes = nodes
  }

  protected runWithRenderCtx<R>(fn: () => R): R {
    const prevSlotOwner = setCurrentSlotOwner(this.slotOwner)
    const prevKeepAliveCtx = setCurrentKeepAliveCtx(this.keepAliveCtx)
    try {
      return fn()
    } finally {
      setCurrentKeepAliveCtx(prevKeepAliveCtx)
      setCurrentSlotOwner(prevSlotOwner)
    }
  }
}

export class ForFragment extends VaporFragment<Block[]> {
  constructor(nodes: Block[]) {
    super(nodes)
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
  isAnchorPending?: boolean
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
      const anchor =
        this.anchor ||
        (currentHydrationNode === currentSlotEndAnchor
          ? currentSlotEndAnchor
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

        if (this.onUpdated) {
          this.onUpdated.forEach(hook => hook(this.nodes))
        }
      }
    } else {
      this.scope = undefined
      this.nodes = []
    }
  }

  hydrate = (isEmpty = false, isSlot = false): void => {
    // early return allows tree-shaking of hydration logic when not used
    if (!isHydrating) return

    // Slot fallback can fall through to an inner empty `v-if` / `v-for`.
    // When fallback runs during hydration, the same fragment can still
    // re-enter `hydrate()` after its empty branch has already hydrated once.
    if (this.isAnchorPending) return

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
      if (this.anchorLabel === 'if' && currentSlotEndAnchor) {
        if (
          currentEmptyFragment !== undefined &&
          (!isValidBlock(this.nodes) || currentEmptyFragment === this)
        ) {
          const endAnchor = currentSlotEndAnchor
          this.isAnchorPending = true
          queuePostFlushCb(() =>
            endAnchor.parentNode!.insertBefore(
              (this.anchor = markHydrationAnchor(
                __DEV__ ? createComment(this.anchorLabel!) : createTextNode(),
              )),
              endAnchor,
            ),
          )
          return
        }
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

export let currentSlotEndAnchor: Node | null = null
function setCurrentSlotEndAnchor(end: Node | null): Node | null {
  try {
    return currentSlotEndAnchor
  } finally {
    currentSlotEndAnchor = end
  }
}

// Tracks slot fallback hydration that falls through an inner empty fragment,
// e.g.
// - `<slot><template v-if="false" /></slot>`
// - `<slot><span v-for="item in items" /></slot>`.
// We need this because the inner empty fragment can hydrate before slot render
// finishes and before we know whether fallback will ultimately land on it.
// - `undefined` means the current hydration is not resolving slot fallback.
// - `null` means slot render is in progress and fallback may land on an empty
//   fragment, but the target fragment is not known yet. Empty `v-for` only
//   needs this phase marker so it can create its own runtime anchor instead of
//   expecting one from SSR.
// - A DynamicFragment value means fallback resolves through that fragment, so it
//   must create its own anchor instead of reusing the slot end anchor.
export let currentEmptyFragment: DynamicFragment | null | undefined

export class SlotFragment extends DynamicFragment {
  forwarded = false
  deferredHydrationBoundary?: () => void

  constructor() {
    super(isHydrating || __DEV__ ? 'slot' : undefined, false, false)
  }

  updateSlot(
    render?: BlockFn,
    fallback?: BlockFn,
    key: any = render || fallback,
  ): void {
    let prevEndAnchor: Node | null = null
    let pushedEndAnchor = false
    let exitHydrationBoundary: (() => void) | undefined
    let deferHydrationBoundary = false
    if (isHydrating) {
      locateHydrationNode()
      if (isComment(currentHydrationNode!, '[')) {
        const endAnchor = locateEndAnchor(currentHydrationNode)
        setCurrentHydrationNode(currentHydrationNode.nextSibling)
        prevEndAnchor = setCurrentSlotEndAnchor(endAnchor)
        pushedEndAnchor = true
        exitHydrationBoundary = enterHydrationBoundary(endAnchor)
      }
    }

    try {
      if (!render || !fallback) {
        this.update(render || fallback, key)
      } else {
        const wrapped = () => {
          const prev = currentEmptyFragment
          if (isHydrating) currentEmptyFragment = null
          try {
            let block = render()
            const emptyFrag = attachSlotFallback(block, fallback)
            if (!isValidBlock(block)) {
              if (isHydrating && emptyFrag instanceof DynamicFragment) {
                currentEmptyFragment = emptyFrag
              }
              block = renderSlotFallback(block, fallback, emptyFrag)
            }
            return block
          } finally {
            if (isHydrating) currentEmptyFragment = prev
          }
        }

        this.update(wrapped, key)
      }

      // Slot render and slot fallback can both trigger DynamicFragment
      // hydrate that tries to reuse the current SSR end anchor. Hydrating
      // the slot before render/fallback resolution finishes can make the
      // slot and inner fallback carrier compete for the same `<!--]-->`, or
      // place synthetic anchors like `<!--if-->` at the wrong position.
      // Wait until render/fallback has fully resolved, then hydrate the slot
      // once against the final block.
      if (isHydrating) {
        this.hydrate(render == null, true)
        // Empty slots rendered while resolving an outer slot fallback can be
        // filled by that fallback immediately after render() returns.
        deferHydrationBoundary =
          !!exitHydrationBoundary &&
          currentEmptyFragment !== undefined &&
          !isValidBlock(this.nodes)
      }
    } finally {
      if (isHydrating) {
        if (pushedEndAnchor) {
          setCurrentSlotEndAnchor(prevEndAnchor)
        }
        if (deferHydrationBoundary) {
          this.deferredHydrationBoundary = exitHydrationBoundary
        } else {
          exitHydrationBoundary && exitHydrationBoundary()
        }
      }
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

export function renderSlotFallback(
  block: Block,
  fallback: BlockFn,
  emptyFragment?: VaporFragment | null,
): Block {
  // emptyFragment comes from attachSlotFallback, but v-if/v-for updates can
  // change which fragment is empty after update(); fall back to a fresh search.
  const frag = emptyFragment || findDeepestEmptyFragment(block)
  if (frag) {
    if (frag instanceof ForFragment) {
      frag.nodes[0] = [fallback() || []] as Block[]
    } else if (frag instanceof DynamicFragment) {
      frag.update(fallback)
      if (isHydrating && frag instanceof SlotFragment) {
        const deferredHydrationBoundary = frag.deferredHydrationBoundary
        if (deferredHydrationBoundary) {
          frag.deferredHydrationBoundary = undefined
          // The fallback has now had a chance to hydrate the SSR nodes that
          // originally belonged to the empty forwarded slot.
          deferredHydrationBoundary()
        }
      }
    }
    return block
  }
  return fallback()
}

export function attachSlotFallback(
  block: Block,
  fallback: BlockFn,
): VaporFragment | null {
  const state = { emptyFrag: null as VaporFragment | null }
  traverseForFallback(block, fallback, state)
  return state.emptyFrag
}

// Tracks per-DynamicFragment fallback and whether update() has been wrapped.
// We need this state to:
// 1) avoid wrapping update() multiple times when attachSlotFallback is called repeatedly,
// 2) allow fallback to be chained/updated as slot fallback propagates through nested fragments.
const slotFallbackState = new WeakMap<
  DynamicFragment,
  { fallback: BlockFn; wrapped: boolean; forOwner?: ForFragment }
>()

// Slot fallback needs to propagate into nested fragments created by v-if/v-for.
// We wrap DynamicFragment.update() once and store fallback state so that when a
// nested branch turns empty later, it can render the slot fallback without
// requiring the parent slot outlet to re-render.
function traverseForFallback(
  block: Block,
  fallback: BlockFn,
  state: { emptyFrag: VaporFragment | null },
  forOwner?: ForFragment,
): void {
  if (isVaporComponent(block)) {
    if (block.block) traverseForFallback(block.block, fallback, state, forOwner)
    return
  }

  if (isArray(block)) {
    for (const item of block)
      traverseForFallback(item, fallback, state, forOwner)
    return
  }

  // v-for fallback is handled by apiCreateFor; keep fallback on fragment
  if (block instanceof ForFragment) {
    block.fallback = chainFallback(block.fallback, fallback)
    if (!isValidBlock(block.nodes)) state.emptyFrag = block
    traverseForFallback(block.nodes, fallback, state, block)
    return
  }

  // Recurse into per-item ForBlock so slot fallback can keep propagating to
  // nested DynamicFragments inside each list item. Gate those updates on the
  // owning `v-for` so a single empty item does not render slot fallback while
  // the list still has valid content.
  if (block instanceof ForBlock) {
    traverseForFallback(block.nodes, fallback, state, forOwner)
    return
  }

  // vdom slot fragment: store fallback on the fragment itself
  if (block instanceof VaporFragment && block.insert) {
    block.fallback = chainFallback(block.fallback, fallback)
    if (!isValidBlock(block.nodes)) state.emptyFrag = block
    traverseForFallback(block.nodes, fallback, state, forOwner)
    return
  }

  // DynamicFragment: chain/record fallback and wrap update() once for empty checks.
  if (block instanceof DynamicFragment) {
    let slotState = slotFallbackState.get(block)
    if (slotState) {
      slotState.fallback = chainFallback(slotState.fallback, fallback)
    } else {
      slotFallbackState.set(
        block,
        (slotState = { fallback, wrapped: false, forOwner }),
      )
    }
    slotState.forOwner = forOwner || slotState.forOwner
    if (!slotState.wrapped) {
      slotState.wrapped = true
      const original = block.update.bind(block)
      block.update = (render?: BlockFn, key?: any) => {
        original(render, key)
        // attach to newly created nested fragments
        const emptyFrag = attachSlotFallback(block.nodes, slotState!.fallback)
        if (
          render !== slotState!.fallback &&
          !isValidBlock(block.nodes) &&
          (!slotState!.forOwner || !isValidBlock(slotState!.forOwner.nodes))
        ) {
          renderSlotFallback(block, slotState!.fallback, emptyFrag)
        }
      }
    }
    if (!isValidBlock(block.nodes)) state.emptyFrag = block
    traverseForFallback(block.nodes, fallback, state, forOwner)
  }
}

function findDeepestEmptyFragment(block: Block): VaporFragment | null {
  let emptyFrag: VaporFragment | null = null
  traverseForEmptyFragment(block, frag => (emptyFrag = frag))
  return emptyFrag
}

function traverseForEmptyFragment(
  block: Block,
  onFound: (frag: VaporFragment) => void,
): void {
  if (isVaporComponent(block)) {
    if (block.block) traverseForEmptyFragment(block.block, onFound)
    return
  }

  if (isArray(block)) {
    for (const item of block) traverseForEmptyFragment(item, onFound)
    return
  }

  if (isFragment(block)) {
    if (!isValidBlock(block.nodes)) onFound(block)
    traverseForEmptyFragment(block.nodes, onFound)
  }
}

function chainFallback(existing: BlockFn | undefined, next: BlockFn): BlockFn {
  if (!existing) return next
  return (...args: any[]) => {
    const res = existing(...args)
    return !isValidBlock(res) ? next(...args) : res
  }
}
