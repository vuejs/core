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
  currentHydrationNode,
  isComment,
  isHydrating,
  locateFragmentEndAnchor,
  locateHydrationNode,
} from './dom/hydration'
import { isArray } from '@vue/shared'
import { renderEffect } from './renderEffect'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots'
import {
  type KeepAliveContext,
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
  anchor!: Node
  scope: EffectScope | undefined
  current?: BlockFn
  pending?: { render?: BlockFn; key: any }
  anchorLabel?: string
  keyed?: boolean

  // fallthrough attrs
  attrs?: Record<string, any>

  // set ref for async wrapper
  setAsyncRef?: (instance: VaporComponentInstance) => void

  keepAliveCtx: KeepAliveContext | null

  slotOwner: VaporComponentInstance | null

  constructor(anchorLabel?: string, keyed: boolean = false) {
    super([])
    this.keyed = keyed
    this.slotOwner = currentSlotOwner
    this.keepAliveCtx = currentKeepAliveCtx
    if (isHydrating) {
      this.anchorLabel = anchorLabel
      locateHydrationNode()
    } else {
      this.anchor =
        __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
      if (__DEV__) this.anchorLabel = anchorLabel
    }
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
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
      if (mode) {
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

    if (isHydrating) this.hydrate()
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

      // restore slot owner
      const prevOwner = setCurrentSlotOwner(this.slotOwner)
      // set currentKeepAliveCtx so nested DynamicFragments and components can capture it
      const prevCtx = setCurrentKeepAliveCtx(keepAliveCtx)
      // switch current instance to parent instance during update
      // ensure that the parent instance is correct for nested components
      const prev = parent && instance ? setCurrentInstance(instance) : undefined
      this.nodes = this.scope.run(render) || []
      if (prev !== undefined) setCurrentInstance(...prev)
      setCurrentKeepAliveCtx(prevCtx)
      setCurrentSlotOwner(prevOwner)

      // set key on nodes
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

    if (this.anchorLabel === 'if') {
      // reuse the empty comment node as the anchor for empty if
      // e.g. `<div v-if="false"></div>` -> `<!---->`
      if (isEmpty) {
        this.anchor = locateFragmentEndAnchor('')!
        if (__DEV__ && !this.anchor) {
          throw new Error(
            'Failed to locate if anchor. this is likely a Vue internal bug.',
          )
        } else {
          if (__DEV__) {
            ;(this.anchor as Comment).data = this.anchorLabel
          }
          return
        }
      }
    } else if (this.anchorLabel === 'slot') {
      // reuse the empty comment node for empty slot
      // e.g. `<slot v-if="false"></slot>`
      if (isEmpty && isComment(currentHydrationNode!, '')) {
        this.anchor = currentHydrationNode!
        if (__DEV__) {
          ;(this.anchor as Comment).data = this.anchorLabel!
        }
        return
      }

      // reuse the vdom fragment end anchor
      this.anchor = locateFragmentEndAnchor()!
      if (__DEV__ && !this.anchor) {
        throw new Error(
          'Failed to locate slot anchor. this is likely a Vue internal bug.',
        )
      } else {
        return
      }
    }

    const { parentNode: pn, nextNode } = findBlockNode(this.nodes)!
    // create an anchor
    queuePostFlushCb(() => {
      pn!.insertBefore(
        (this.anchor = __DEV__
          ? createComment(this.anchorLabel!)
          : createTextNode()),
        nextNode,
      )
    })
  }
}

export class SlotFragment extends DynamicFragment {
  constructor() {
    super(isHydrating || __DEV__ ? 'slot' : undefined)
  }

  updateSlot(render?: BlockFn, fallback?: BlockFn, key: any = render): void {
    if (!render || !fallback) {
      this.update(render || fallback, key)
      return
    }

    const wrapped = () => {
      const block = render()
      attachSlotFallback(block, fallback)
      if (!isValidBlock(block)) {
        return renderSlotFallback(block, fallback)
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

export function renderSlotFallback(block: Block, fallback: BlockFn): Block {
  const target = findDeepestEmptyFragment(block)
  if (target) {
    if (target instanceof ForFragment) {
      target.nodes[0] = [fallback() || []] as Block[]
    } else if (target instanceof DynamicFragment) {
      target.update(fallback)
    }
    return block
  }
  return fallback()
}

export function attachSlotFallback(block: Block, fallback: BlockFn): void {
  traverseForFallback(block, fallback)
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
function traverseForFallback(block: Block, fallback: BlockFn): void {
  if (isVaporComponent(block)) {
    if (block.block) traverseForFallback(block.block, fallback)
    return
  }

  if (isArray(block)) {
    for (const item of block) traverseForFallback(item, fallback)
    return
  }

  // v-for fallback is handled by apiCreateFor; keep fallback on fragment
  if (block instanceof ForFragment) {
    block.fallback = chainFallback(block.fallback, fallback)
    traverseForFallback(block.nodes, fallback)
    return
  }

  // vdom slot fragment: store fallback on the fragment itself
  if (block instanceof VaporFragment && block.insert) {
    block.fallback = chainFallback(block.fallback, fallback)
    traverseForFallback(block.nodes, fallback)
    return
  }

  // DynamicFragment: chain/record fallback and wrap update() once for empty checks.
  if (block instanceof DynamicFragment) {
    let state = slotFallbackState.get(block)
    if (state) {
      state.fallback = chainFallback(state.fallback, fallback)
    } else {
      slotFallbackState.set(block, (state = { fallback, wrapped: false }))
    }
    if (!state.wrapped) {
      state.wrapped = true
      const original = block.update.bind(block)
      block.update = (render?: BlockFn, key?: any) => {
        original(render, key)
        // attach to newly created nested fragments
        attachSlotFallback(block.nodes, state.fallback)
        if (render !== state.fallback && !isValidBlock(block.nodes)) {
          renderSlotFallback(block, state.fallback)
        }
      }
    }
    traverseForFallback(block.nodes, fallback)
  }
}

function findDeepestEmptyFragment(block: Block): VaporFragment | null {
  let found: VaporFragment | null = null
  traverseForEmptyFragment(block, frag => (found = frag))
  return found
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
    setKey(block.block, key)
  } else if (isArray(block)) {
    for (const b of block) {
      setKey(b, key)
    }
  } else {
    setKey(block.nodes, key)
  }
}
