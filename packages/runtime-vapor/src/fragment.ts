import { EffectScope, setActiveSub } from '@vue/reactivity'
import { createComment, createTextNode } from './dom/node'
import {
  type Block,
  type BlockFn,
  type TransitionOptions,
  type VaporTransitionHooks,
  applyTransitionHooks,
  applyTransitionLeaveHooks,
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
  currentHydrationNode,
  isComment,
  isHydrating,
  locateHydrationNode,
} from './dom/hydration'
import { isArray } from '@vue/shared'
import { renderEffect } from './renderEffect'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots'
import {
  type VaporKeepAliveContext,
  currentKeepAliveCtx,
  setCurrentKeepAliveCtx,
} from './components/KeepAlive'

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

  constructor(nodes: T) {
    this.nodes = nodes
  }
}

export class ForFragment extends VaporFragment<Block[]> {
  constructor(nodes: Block[]) {
    super(nodes)
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

  keepAliveCtx: VaporKeepAliveContext | null

  slotOwner: VaporComponentInstance | null

  constructor(
    anchorLabel?: string,
    keyed: boolean = false,
    locate: boolean = true,
  ) {
    super([])
    this.keyed = keyed
    this.slotOwner = currentSlotOwner
    this.keepAliveCtx = currentKeepAliveCtx
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
      if (isHydrating) this.hydrate(true)
      return
    }

    const transition = this.$transition
    // currently leaving: defer mounting the next branch until
    // the leave finishes.
    if (transition && transition.state.isLeaving) {
      this.current = key
      this.pending = { render, key }
      return
    }

    const prevKey = this.current
    this.current = key

    const instance = currentInstance
    const prevSub = setActiveSub()
    const parent = isHydrating ? null : this.anchor.parentNode
    // teardown previous branch
    if (this.scope) {
      let retainScope = false
      const keepAliveCtx = this.keepAliveCtx

      // if keepAliveCtx exists and processShapeFlag returns true,
      // cache the scope and retain it
      if (keepAliveCtx && keepAliveCtx.processShapeFlag(this.nodes)) {
        keepAliveCtx.cacheScope(prevKey, this.scope)
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
          const pending = this.pending
          if (pending) {
            this.pending = undefined
            this.current = pending.key
            this.renderBranch(pending.render, transition, parent, instance)
          } else {
            this.renderBranch(render, transition, parent, instance)
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

    this.renderBranch(render, transition, parent, instance)
    setActiveSub(prevSub)

    if (isHydrating) this.hydrate(render == null)
  }

  renderBranch(
    render: BlockFn | undefined,
    transition: VaporTransitionHooks | undefined,
    parent: ParentNode | null,
    instance: GenericComponentInstance | null,
  ): void {
    if (render) {
      const keepAliveCtx = this.keepAliveCtx
      // try to reuse the kept-alive scope
      const scope = keepAliveCtx && keepAliveCtx.getScope(this.current)
      if (scope) {
        this.scope = scope
      } else {
        this.scope = new EffectScope()
      }

      const prevSlotOwner = setCurrentSlotOwner(this.slotOwner)
      // set currentKeepAliveCtx so nested DynamicFragments and components can capture it
      const prevKeepAliveCtx = setCurrentKeepAliveCtx(keepAliveCtx)
      const needBranchKey = keepAliveCtx && this.keyed
      const prevBranchKey = needBranchKey
        ? keepAliveCtx.setCurrentBranchKey(this.current)
        : undefined
      const prevInstance = setCurrentInstance(instance)
      try {
        this.nodes = this.scope.run(render) || []
      } finally {
        setCurrentInstance(...prevInstance)
        if (needBranchKey) keepAliveCtx.setCurrentBranchKey(prevBranchKey)
        setCurrentKeepAliveCtx(prevKeepAliveCtx)
        setCurrentSlotOwner(prevSlotOwner)
      }

      // set key on blocks
      if (this.keyed) setKey(this.nodes, this.current)

      if (transition) {
        this.$transition = applyTransitionHooks(this.nodes, transition)
      }

      // call processShapeFlag to mark shapeFlag before mounting
      if (keepAliveCtx) {
        keepAliveCtx.processShapeFlag(this.nodes)
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

  hydrate = (isEmpty = false): void => {
    // early return allows tree-shaking of hydration logic when not used
    if (!isHydrating) return

    // avoid repeated hydration
    if (this.anchor) return

    // reuse `<!---->` as anchor
    // `<div v-if="false"></div>` -> `<!---->`
    if (isEmpty) {
      if (isComment(currentHydrationNode!, '')) {
        this.anchor = currentHydrationNode
        advanceHydrationNode(currentHydrationNode)
        if (__DEV__) {
          ;(this.anchor as Comment).data = this.anchorLabel!
        }
        return
      }
    }

    const forwardedSlot = (this as any as SlotFragment).forwarded
    let isValidSlot = false
    // Empty forwarded slot with a fallback: skip anchor creation and
    // let renderSlotFallback → frag.update(fallback) re-enter hydrate()
    // to create the anchor after the fallback content is hydrated.
    if (
      forwardedSlot &&
      (isEmpty || !(isValidSlot = isValidBlock(this.nodes))) &&
      (this as any as SlotFragment).hasFallback
    ) {
      return
    }

    // reuse the `<!--]-->` as anchor
    // - slot (forwarded slots can only reuse when they own SSR-rendered
    //   content; when re-entering through renderSlotFallback, the
    //   `<!--]-->` still belongs to the outer slot)
    // - multi-root if
    if (
      (this.anchorLabel === 'slot' &&
        (!forwardedSlot || (isValidSlot && !isInSlotFallback))) ||
      (this.anchorLabel === 'if' && isArray(this.nodes))
    ) {
      if (isComment(currentHydrationNode!, ']')) {
        this.anchor = currentHydrationNode
        advanceHydrationNode(currentHydrationNode)
        return
      } else if (__DEV__) {
        throw new Error(
          `Failed to locate ${this.anchorLabel} fragment anchor. this is likely a Vue internal bug.`,
        )
      }
    }

    // otherwise, create an anchor.
    // forwarded slot without a reusable SSR end anchor,
    // dynamic-component, async component, keyed fragment
    let parentNode: Node | null
    let nextNode: Node | null
    if (forwardedSlot) {
      parentNode = currentHydrationNode!.parentNode
      nextNode = currentHydrationNode!.nextSibling
    } else {
      const node = findBlockNode(this.nodes)
      parentNode = node.parentNode
      nextNode = node.nextNode
    }
    queuePostFlushCb(() => {
      parentNode!.insertBefore(
        (this.anchor = __DEV__
          ? createComment(this.anchorLabel!)
          : createTextNode()),
        nextNode,
      )
    })
  }
}

let currentSlotHasFallback = false
let isInSlotFallback = false

export class SlotFragment extends DynamicFragment {
  forwarded = false
  hasFallback = false

  constructor() {
    super(isHydrating || __DEV__ ? 'slot' : undefined, false, false)
  }

  updateSlot(
    render?: BlockFn,
    fallback?: BlockFn,
    key: any = render || fallback,
  ): void {
    if (isHydrating) {
      locateHydrationNode(true)
      if (this.forwarded) {
        this.hasFallback = currentSlotHasFallback
      }
    }

    if (!render || !fallback) {
      this.update(render || fallback, key)
      return
    }

    const wrapped = () => {
      const prev = currentSlotHasFallback
      currentSlotHasFallback = true
      let block: Block
      try {
        block = render()
      } finally {
        currentSlotHasFallback = prev
      }
      const emptyFrag = attachSlotFallback(block, fallback)
      if (!isValidBlock(block)) {
        return renderSlotFallback(block, fallback, emptyFrag)
      }
      return block
    }

    this.update(wrapped, key)
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
      const prev = isInSlotFallback
      isInSlotFallback = true
      try {
        frag.update(fallback)
      } finally {
        isInSlotFallback = prev
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
  { fallback: BlockFn; wrapped: boolean }
>()

// Slot fallback needs to propagate into nested fragments created by v-if/v-for.
// We wrap DynamicFragment.update() once and store fallback state so that when a
// nested branch turns empty later, it can render the slot fallback without
// requiring the parent slot outlet to re-render.
function traverseForFallback(
  block: Block,
  fallback: BlockFn,
  state: { emptyFrag: VaporFragment | null },
): void {
  if (isVaporComponent(block)) {
    if (block.block) traverseForFallback(block.block, fallback, state)
    return
  }

  if (isArray(block)) {
    for (const item of block) traverseForFallback(item, fallback, state)
    return
  }

  // v-for fallback is handled by apiCreateFor; keep fallback on fragment
  if (block instanceof ForFragment) {
    block.fallback = chainFallback(block.fallback, fallback)
    if (!isValidBlock(block.nodes)) state.emptyFrag = block
    traverseForFallback(block.nodes, fallback, state)
    return
  }

  // vdom slot fragment: store fallback on the fragment itself
  if (block instanceof VaporFragment && block.insert) {
    block.fallback = chainFallback(block.fallback, fallback)
    if (!isValidBlock(block.nodes)) state.emptyFrag = block
    traverseForFallback(block.nodes, fallback, state)
    return
  }

  // DynamicFragment: chain/record fallback and wrap update() once for empty checks.
  if (block instanceof DynamicFragment) {
    let slotState = slotFallbackState.get(block)
    if (slotState) {
      slotState.fallback = chainFallback(slotState.fallback, fallback)
    } else {
      slotFallbackState.set(block, (slotState = { fallback, wrapped: false }))
    }
    if (!slotState.wrapped) {
      slotState.wrapped = true
      const original = block.update.bind(block)
      block.update = (render?: BlockFn, key?: any) => {
        original(render, key)
        // attach to newly created nested fragments
        const emptyFrag = attachSlotFallback(block.nodes, slotState!.fallback)
        if (render !== slotState!.fallback && !isValidBlock(block.nodes)) {
          renderSlotFallback(block, slotState!.fallback, emptyFrag)
        }
      }
    }
    if (!isValidBlock(block.nodes)) state.emptyFrag = block
    traverseForFallback(block.nodes, fallback, state)
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

function setKey(block: Block & { $key?: any }, key: any) {
  if (block instanceof Node) {
    block.$key = key
  } else if (isVaporComponent(block)) {
    block.key = key
    setKey(block.block, key)
  } else if (isArray(block)) {
    for (const b of block) {
      setKey(b, key)
    }
  } else {
    block.$key = key
    setKey(block.nodes, key)
  }
}
