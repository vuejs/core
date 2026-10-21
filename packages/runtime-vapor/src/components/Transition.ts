import {
  type BaseTransitionProps,
  ErrorCodes,
  type GenericComponentInstance,
  type SuspenseBoundary,
  type TransitionElement,
  type TransitionHooks,
  type TransitionHooksContext,
  type TransitionProps,
  TransitionPropsValidators,
  type TransitionState,
  baseResolveTransitionHooks,
  callWithErrorHandling,
  checkTransitionMode,
  currentInstance,
  enterCbKey,
  isAsyncWrapper,
  isKeepAlive,
  isTemplateNode,
  leaveCbKey,
  queueJob,
  queuePostFlushCb,
  queuePostRenderEffect,
  resolveTransitionProps,
  restoreCurrentInstance,
  setCurrentInstance,
  useTransitionState,
  warn,
} from '@vue/runtime-dom'
import { computed } from '@vue/reactivity'
import {
  type Block,
  type BlockFn,
  EMPTY_BLOCK,
  type TransitionOptions,
  VShowFlags,
  type VaporTransitionHooks,
  type VaporTransitionState,
  isValidBlock,
  remove,
  settleMountShown,
} from '../block'
import {
  displayName,
  isVaporTransition,
  isVaporTransitionHooks,
  registerTransitionHooks,
} from '../transition'
import {
  type FunctionalVaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { getAsyncWrapperInner } from '../apiDefineAsyncComponent'
import { isAsyncComponentEnabled } from '../asyncComponentState'
import { extend, isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'
import {
  DynamicFragment,
  type VaporFragment,
  getFragmentKey,
  isDynamicFragment,
  isForFragment,
  isFragment,
  isSlotOutletFragment,
  isVaporSlotOutlet,
  runWithRenderCtx,
} from '../fragment'
import { isKeepAliveEnabled } from '../keepAlive'
import { isSuspenseEnabled } from '../suspense'
import { DYNAMIC, SLOT_ROOT, TELEPORT } from '../fragmentFlags'
import {
  type SlotResolutionState,
  isSlotFallbackBlock,
  setSettlingNotify,
} from '../slotFragment'
import type { SlotBoundaryContext } from '../slotBoundary'
import {
  currentHydrationNode,
  isHydrating,
  locateHydrationNode,
  setCurrentHydrationNode,
} from '../dom/hydration'
import { updateLastLocatedLogicalChild } from '../dom/node'
import { isInteropEnabled } from '../vdomInteropState'

export type ResolvedTransitionBlock = (
  | Element
  | VaporFragment
  | DynamicFragment
) &
  TransitionOptions

// What takes the hooks for content it renders later: a fragment, or a
// component whose async setup has not resolved yet.
type HooksTarget = VaporFragment | (VaporComponentInstance & TransitionOptions)

let registered = false
export const ensureTransitionHooksRegistered = (): void => {
  if (!registered) {
    registered = true
    registerTransitionHooks(
      applyTransitionHooksImpl,
      applyTransitionLeaveHooksImpl,
      deferBranchUpdateDuringLeaveImpl,
      removeBranchWithLeaveImpl,
      ownsMode,
      awaitLeavingRootImpl,
      resolveOutletLeaveImpl,
      deferSlotRootFlipImpl,
    )
  }
}

// Adopts the <template> the server wraps an appearing Transition's content in;
// returns the appear to perform once the content's hooks are applied.
export const hydrateTransitionImpl = (
  suspense: SuspenseBoundary | null,
): ((block: Block, hooks: TransitionHooks) => void) | undefined => {
  if (!currentHydrationNode || !isTemplateNode(currentHydrationNode)) return
  // replace <template> node with inner child
  const templateNode = currentHydrationNode
  const { content, parentNode } = templateNode
  const { firstChild } = content
  if (firstChild) {
    let transitionEl: Element | undefined
    // firstChild may be a fragment anchor comment (e.g. <!--[--> from slotted
    // content), but appear hooks still need to target the actual element.
    for (
      let node: ChildNode | null = firstChild;
      node;
      node = node.nextSibling
    ) {
      if (node instanceof Element) {
        transitionEl = node
        break
      }
    }

    parentNode!.insertBefore(content, templateNode)
    parentNode!.removeChild(templateNode)
    updateLastLocatedLogicalChild(parentNode!, templateNode, firstChild)
    setCurrentHydrationNode(firstChild)

    if (
      transitionEl instanceof HTMLElement ||
      transitionEl instanceof SVGElement
    ) {
      const originalDisplay = transitionEl.style.display
      transitionEl.style.display = 'none'

      return (block: Block, hooks: TransitionHooks) => {
        // A child rendering its root later (an async setup, an async wrapper
        // loading) hydrates it on screen already: it does not appear, as
        // under vdom's Suspense.
        if (!findTransitionBlock(block)) {
          transitionEl.style.display = originalDisplay
          return
        }
        hooks.beforeEnter(transitionEl)
        transitionEl.style.display = originalDisplay
        queuePostRenderEffect(
          () => hooks.enter(transitionEl),
          undefined,
          suspense,
        )
      }
    }
  }
}

const decorate = (t: typeof VaporTransition) => {
  t.displayName = displayName
  t.props = TransitionPropsValidators
  t.__vapor = true
  return t
}

export const VaporTransition: FunctionalVaporComponent<TransitionProps> =
  /*@__PURE__*/ decorate((props, { slots, expose }) => {
    // @ts-expect-error
    expose()

    // Register transition hooks on first use
    ensureTransitionHooksRegistered()

    const instance = currentInstance! as VaporComponentInstance
    const performAppear = isHydrating
      ? hydrateTransitionImpl(instance.suspense)
      : undefined
    const state: VaporTransitionState = useTransitionState()
    const { mode } = props
    __DEV__ && checkTransitionMode(mode)

    const resolvedProps = computed(() => resolveTransitionProps(props))
    const propsProxy = new Proxy({} as BaseTransitionProps<Element>, {
      get(_, key) {
        return resolvedProps.value[key as keyof BaseTransitionProps<Element>]
      },
    })

    if (__DEV__) {
      state.refresh = hooks =>
        applyTransitionHooksImpl(state.root!, hooks, undefined, true)
    }

    const shouldPerformAppear = !!props.appear && !!performAppear
    // Dynamic slot sources can add/remove the default slot after setup, so
    // Transition needs a DynamicFragment to drive enter/leave on updates.
    if (instance.rawSlots.$) {
      const frag = new DynamicFragment(0, __DEV__ ? 'transition' : undefined)
      if (isHydrating) locateHydrationNode()
      state.root = frag
      let isMounted = false
      renderEffect(() => {
        if (!frag.$transition) {
          frag.$transition = resolveTransitionHooks(
            frag,
            propsProxy,
            state,
            instance,
          )
        } else {
          // DynamicFragment.update() reads the fragment hook's mode directly,
          // so keep it in sync when Transition mode changes reactively.
          frag.$transition.mode = resolvedProps.value.mode
        }
        const prevNodes = frag.nodes
        frag.update(slots.default)
        // Reactive prop changes without a branch re-render: rebind the current
        // root to fresh closures, since baseResolveTransitionHooks captures
        // props eagerly (renderBranch already rebinds when it re-renders).
        if (isMounted && frag.nodes === prevNodes && !state.isLeaving) {
          frag.$transition = applyTransitionHooksImpl(
            frag.nodes,
            frag.$transition,
            undefined,
            true,
          )
        }
        if (!isMounted && shouldPerformAppear) {
          performAppear(frag, frag.$transition!)
        }
        isMounted = true
      })
      return frag
    }

    const children = ((slots.default && slots.default()) || []) as any as Block
    state.root = children

    const hooks = {
      __vapor: true,
      state,
      // use proxy to keep props reference stable
      props: propsProxy,
      instance: instance,
    } as VaporTransitionHooks
    let isMounted = false
    // Re-resolve hooks when reactive transition props (:name/:duration/event
    // hooks/mode) change. The shared baseResolveTransitionHooks destructures
    // props eagerly, so propsProxy alone can't keep an already-applied hooks
    // closure live; re-applying rebinds the root element's (and any inner
    // fragment's) $transition to fresh closures, mirroring VDOM's per-render
    // re-resolve. Read runtime state (delayedLeave) from the current branch
    // without retaining an earlier branch's hooks in this effect.
    renderEffect(() => {
      // tracked here: a leaving root sits a refresh out without resolving.
      // A branch keeps these hooks until it renders a child to resolve them
      // for, and DynamicFragment.update() reads their mode meanwhile.
      hooks.mode = resolvedProps.value.mode
      const appliedHooks = applyTransitionHooksImpl(
        children,
        hooks,
        undefined,
        isMounted,
      )
      if (!isMounted) {
        isMounted = true
        if (shouldPerformAppear) performAppear(children, appliedHooks)
      }
    })
    return children
  })

function getTransitionType(block: ResolvedTransitionBlock): any {
  const type = block.$ttype
  if (type !== undefined) return type
  if (block instanceof Element) return block.localName
  if (isInteropEnabled && isFragment(block) && block.getTransitionType) {
    const type = block.getTransitionType()
    if (type !== undefined) return type
  }
  return block
}

function getLeavingNodesForType(
  state: TransitionState,
  block: ResolvedTransitionBlock,
): Record<string, ResolvedTransitionBlock> {
  const { leavingNodes } = state
  const type = getTransitionType(block)
  let nodes = leavingNodes.get(type) as Record<string, ResolvedTransitionBlock>
  if (!nodes) {
    nodes = Object.create(null)
    leavingNodes.set(type, nodes)
  }
  return nodes
}

// Registers `block` as leaving before its leave runs, as a vdom in-out
// `delayLeave` does for its vnode: a re-entering copy early-removes it.
export function markLeavingBlock(
  block: ResolvedTransitionBlock,
  state: TransitionState,
): void {
  getLeavingNodesForType(state, block)[String(block.$tkey)] = block
}

const getTransitionHooksContext = (
  block: ResolvedTransitionBlock,
  state: TransitionState,
) => {
  const key = String(block.$tkey)
  const leavingNodes = getLeavingNodesForType(state, block)
  const context: TransitionHooksContext = {
    isLeaving: () => leavingNodes[key] === block,
    setLeavingNodeCache: () => {
      leavingNodes[key] = block
    },
    unsetLeavingNodeCache: () => {
      if (leavingNodes[key] === block) {
        delete leavingNodes[key]
      }
    },
    earlyRemove: () => {
      const leavingNode = leavingNodes[key]
      // Mirror VDOM's isSameVNodeType raw-key guard. The type dimension is
      // already isolated by the leaving-cache bucket, but the slot index is
      // String($key), which coerces e.g. 1 and '1' into the same slot. Compare
      // the raw keys so a number-keyed leaving node isn't force-removed by a
      // string-keyed entering node (and vice versa).
      if (leavingNode && leavingNode.$tkey === block.$tkey) {
        const el = getTransitionElement(leavingNode) as
          | TransitionElement
          | undefined
        if (el && el[leaveCbKey]) {
          // force early removal (not cancelled)
          el[leaveCbKey]!()
        }
      }
    },
  }
  return context
}

export function resolveTransitionHooks(
  block: ResolvedTransitionBlock,
  props: TransitionProps,
  state: VaporTransitionState,
  instance: GenericComponentInstance,
): VaporTransitionHooks {
  const context = getTransitionHooksContext(block, state)
  const hooks = baseResolveTransitionHooks(
    context,
    props,
    state,
    instance,
  ) as VaporTransitionHooks
  hooks.__vapor = true
  hooks.persisted = hooks.persisted || !!state.persisted
  hooks.state = state
  hooks.props = props
  hooks.instance = instance as VaporComponentInstance
  return hooks
}

export function applyTransitionHooksImpl(
  block: Block,
  hooks: VaporTransitionHooks,
  owner?: VaporFragment,
  refresh = false,
  // the key context `block` resolves in, when not its owner's (a component
  // root rendered after its async setup)
  ctx?: KeyContext,
): VaporTransitionHooks {
  // the one child beside comments; the array is walked as it is, its
  // positions keying the children
  let single = block
  if (isArray(block)) {
    const children = block.filter(b => !(b instanceof Comment))
    if (children.length === 1) {
      single = children[0]
    } else if (children.length === 0) {
      // relayed vdom hooks: the vdom Transition keeps waiting on its own
      if (!refresh && isVaporTransitionHooks(hooks)) {
        releaseDelayedLeave(hooks)
      }
      return hooks
    }
  }

  // Delegate list/root-slot wrappers back to TransitionGroup's apply logic.
  // Other fragment shapes, such as keyed v-if branches, still need normal
  // enter/leave hooks for their resolved single child.
  if (
    hooks.applyGroup &&
    (isForFragment(single) ||
      isVaporSlotOutlet(single) ||
      (isVaporComponent(single) && isVaporSlotOutlet(single.block)))
  ) {
    hooks.applyGroup(single, hooks.props, hooks.state, hooks.instance)
    return hooks
  }

  // hooks relayed from a vdom Transition have nothing to resolve from
  if (!isVaporTransitionHooks(hooks)) {
    relayTransitionHooks(block, hooks)
    return hooks
  }

  const fragments: HooksTarget[] = []
  const child = resolveTransitionBlock(
    block,
    fragment => {
      fragments.push(fragment)
      // Inner branches can replace their hooks without updating outer roots.
      // Keep the current handoff even when the branch has no element yet.
      if (refresh && fragment.$transition) hooks = fragment.$transition
    },
    owner,
    ctx,
  )
  if (refresh && child) {
    if (child.$transition) hooks = child.$transition
    // a leaving root keeps the hooks running its leave ($removing); the next
    // branch resolves its own when it renders
    if (child.$removing) return hooks
  }
  if (!child) {
    if (!refresh) {
      // vdom keeps the current child for a component child, however long its
      // root stays empty, and the leave handed to it with it: the root
      // entering later runs it. Only a branch with no component is empty.
      if (hasComponent(block)) {
        const pendingLeave = claimPendingLeave(hooks.state)
        if (pendingLeave) {
          hooks = extend({}, hooks, { delayedLeave: pendingLeave })
        }
      } else {
        releaseDelayedLeave(hooks)
      }
    }
    // set transition hooks on fragments for later use
    fragments.forEach(f => (f.$transition = hooks))
    // warn if no child and no fragments
    if (__DEV__ && fragments.length === 0) {
      warn('Transition component has no valid child element')
    }
    return hooks
  }

  const { props, instance, state, delayedLeave } = hooks
  state.persisted = isPersistedRoot(state.root, owner)
  const resolvedHooks = resolveTransitionHooks(child, props, state, instance)
  // an element entering now (a slot fallback) claims the leave waiting on the
  // Transition; one already in the DOM does not enter
  const pendingLeave =
    !refresh && child instanceof Element && !child.parentNode
      ? claimPendingLeave(state)
      : undefined
  resolvedHooks.delayedLeave = pendingLeave || delayedLeave
  child.$transition = resolvedHooks
  settleMountShown(child)
  fragments.forEach(f => (f.$transition = resolvedHooks))
  return resolvedHooks
}

// Hooks a vnode-level Transition resolved for a vapor component vnode (a vdom
// Transition's child, or a vnode child of a vapor one) are keyed by that
// vnode and carry its handoffs (`afterLeave`, `delayedLeave`): every root the
// component renders relays them as they are, as a vdom child's roots inherit
// them, and an entering root early-removes the leaving one through the vnode.
export function relayTransitionHooks(
  block: Block,
  hooks: TransitionHooks,
): ResolvedTransitionBlock | undefined {
  const relayed = hooks as VaporTransitionHooks
  const child = findTransitionBlock(block, f => (f.$transition = relayed))
  if (child) {
    child.$transition = relayed
    settleMountShown(child)
  }
  return child
}

// Runtime equivalent of the compiler's persisted rule for roots the compiler
// can't see (slot content): the v-show target is reached from Transition's
// root through components and slot outlets only; a v-if / v-for / dynamic
// slot boundary before it makes the root structural, and so does `swap`, an
// outlet switching branches (vdom never persists a root reached through a
// slot). Walked from the root on every apply so branch swaps can't latch a
// stale result. Only a directive target counts: a v-show inherited from above
// the Transition leaves the root structural, as vdom's does.
function isPersistedRoot(
  block: Block | undefined,
  swap?: VaporFragment,
): boolean {
  while (block) {
    if ((block as TransitionOptions).$vshow! & VShowFlags.TARGET) return true
    if (isVaporComponent(block)) {
      if (isVaporTransition(block.type)) return false
      block =
        isAsyncComponentEnabled && isAsyncWrapper(block)
          ? getAsyncWrapperInner(block)
          : block.block
    } else if (isArray(block)) {
      block = block.find(b => !(b instanceof Comment))
    } else if (
      isFragment(block) &&
      (isVaporSlotOutlet(block)
        ? block !== swap
        : !(isDynamicFragment(block) || isForFragment(block)))
    ) {
      block = block.nodes
    } else {
      return false
    }
  }
  return false
}

// The root leaving `outlet` may hold hooks resolved persisted through it, as
// the Transition's own root.
function resolveOutletLeaveImpl(
  outlet: VaporFragment | undefined,
  block: Block,
  hooks: TransitionHooks,
): boolean {
  // relayed vdom hooks: the vdom Transition's own rule applies
  if (!isVaporTransitionHooks(hooks)) return hooks.persisted
  const { state } = hooks
  // an interop outlet's state has no fragment in the walk
  if (!outlet) return hooks.persisted || !!state.persisted
  if (hooks.props.persisted) return true
  // leave hooks resolved for this switch fold it in
  state.persisted = isPersistedRoot(state.root, outlet)
  // only a branch persisted on its own holds such hooks
  if (!state.persisted && isPersistedRoot(block)) {
    const child = findTransitionBlock(block)
    const childHooks = child && child.$transition
    if (childHooks && childHooks.persisted) {
      child.$transition = extend({}, childHooks, { persisted: false })
    }
  }
  return state.persisted
}

export function applyTransitionLeaveHooksImpl(
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
  // No incoming branch is paired with this leave (a branch leaving to nothing,
  // a slot fallback leaving before its content): out-in does not hold branch
  // updates for it; in-out stores the handoff on the Transition, where the
  // next entering block claims it, and runs it after the flush when none does.
  unpaired = false,
  // paired in-out: the fragment switching to the incoming branch
  owner?: VaporFragment,
): boolean {
  const leavingBlock = findTransitionBlock(block)
  if (!leavingBlock) return false
  // a block that never entered the DOM (a root rendered held) has nothing to
  // animate: the branch switches at once, as vdom's does after the leave
  const el = getTransitionElement(leavingBlock)
  if (!el || !el.parentNode) return false

  const { props, state, instance } = enterHooks
  const { mode } = props
  // the Transition's other branches wait on a paired leave (out-in)
  const pairedState = unpaired ? undefined : state
  // Chained onto the removal leave already running ($removing): unpaired,
  // only when a branch follows, as vdom's out-in waits only for an element
  // child; a paired out-in swap, as for a leave of its own.
  const runningLeave = leavingBlock.$removing
  if (runningLeave && (unpaired || mode === 'out-in')) {
    if (unpaired) {
      const leavingFrag = findLeavingFragment(block)
      const next = leavingFrag && leavingFrag.pending
      if (!(next && next.render)) return false
    }
    chainAfterLeave(runningLeave, afterLeaveCb, pairedState)
    return true
  }

  const leavingHooks = resolveTransitionHooks(
    leavingBlock,
    props,
    state,
    instance,
  )
  leavingBlock.$transition = leavingHooks

  if (mode === 'out-in') {
    chainAfterLeave(
      leavingHooks,
      () => {
        afterLeaveCb()
        leavingBlock.$transition = undefined
        delete leavingHooks.afterLeave
      },
      pairedState,
    )
  } else if (mode === 'in-out') {
    leavingHooks.delayLeave = (
      block: TransitionElement,
      earlyRemove,
      delayedLeave,
    ) => {
      const leavingNodes = getLeavingNodesForType(state, leavingBlock)
      const leavingKey = String(leavingBlock.$tkey)
      leavingNodes[leavingKey] = leavingBlock
      const delayedLeaveCb = createDelayedLeave(leavingBlock, delayedLeave)
      // early removal callback
      block[leaveCbKey] = () => {
        delayedLeaveCb(true)
        earlyRemove()
        block[leaveCbKey] = undefined
        leavingBlock.$transition = undefined
        // Same-key in-out switches early-remove the previous leaving block.
        // Clear the cache entry so the next enter isn't skipped as "still leaving".
        if (leavingNodes[leavingKey] === leavingBlock) {
          delete leavingNodes[leavingKey]
        }
      }
      if (unpaired) {
        // A leave the leaving block's own enter still holds runs when that
        // enter ends or is cancelled, as vdom's; one whose enter never ran
        // (torn down in the flush it mounted) waits with this leave instead.
        if (!block[enterCbKey]) releaseDelayedLeave(enterHooks)
        queuePendingLeave(state, delayedLeaveCb)
      } else {
        // to the hooks the incoming branch holds when the leave starts: the
        // copy, or its own once it rendered first (a KeepAlive's late removal)
        owner!.$transition!.delayedLeave = delayedLeaveCb
      }
    }
  }
  return true
}

function hasComponent(block: Block): boolean {
  if (isVaporComponent(block)) return true
  if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      if (hasComponent(block[i])) return true
    }
    return false
  }
  return isFragment(block) && hasComponent(block.nodes)
}

// in-out: the branch these hooks were handed a leave for rendered nothing, so
// nothing of its own enters to run it. As for vdom's empty child it runs after
// the flush, unless an element entering meanwhile (a slot fallback) claims it.
function releaseDelayedLeave(hooks: VaporTransitionHooks): void {
  const delayedLeave = hooks.delayedLeave
  if (delayedLeave) {
    hooks.delayedLeave = undefined
    queuePendingLeave(hooks.state, delayedLeave)
  }
}

export function queuePendingLeave(
  state: VaporTransitionState,
  leave: () => void,
): void {
  const pending = state.pendingLeave
  if (pending) {
    // one leave waits at a time: an earlier one runs along with this one
    const incoming = leave
    leave = () => {
      pending()
      incoming()
    }
  }
  state.pendingLeave = leave
  queuePostFlushCb(() => {
    if (state.pendingLeave === leave) {
      state.pendingLeave = undefined
      leave()
    }
  })
}

export function claimPendingLeave(
  state: VaporTransitionState,
): (() => void) | undefined {
  const leave = state.pendingLeave
  state.pendingLeave = undefined
  return leave
}

// Hooks copies share this callback. Keep its captures separate from the
// branch's hooks and release them when the handoff completes or is cancelled.
function createDelayedLeave(
  block: ResolvedTransitionBlock | undefined,
  leave: (() => void) | undefined,
): (cancelled?: boolean) => void {
  return cancelled => {
    if (!leave) return
    const cb = leave
    const leavingBlock = block!
    // Settle before invoking hooks, which can synchronously trigger another leave.
    leave = block = undefined
    if (!cancelled) {
      cb()
      leavingBlock.$transition = undefined
    }
  }
}

// vdom applies `mode` where Transition itself re-renders, i.e. down to its
// child component; a fragment inside that component only inherits the
// enter / leave hooks, as does one under hooks a vdom Transition relayed. An
// interop outlet's state has no fragment in the walk: the mode is its own.
function ownsMode(hooks: TransitionHooks, frag?: VaporFragment): boolean {
  if (!isVaporTransitionHooks(hooks)) return false
  const ctx = frag && frag.$keyCtx
  return !ctx || !ctx.type
}

function deferBranchUpdateDuringLeaveImpl(
  frag: DynamicFragment,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
  branchKey: any,
  prevKey: any,
): boolean {
  const transition = frag.$transition!
  if (!ownsMode(transition, frag)) return false
  const { isLeaving } = transition.state
  // a sibling root rendering a branch from nothing is one side of the swap
  // vdom renders at once: it renders once its siblings updated, which may
  // leave in this flush (settleSiblingRoots)
  const sibling =
    !isLeaving &&
    !!render &&
    holdsForSiblings(frag, transition) &&
    !isValidBlock(frag.nodes)
  if (!isLeaving && !sibling) {
    // updated past a deferred render: that one is stale
    if (frag.pending && !frag.leaving) frag.pending = undefined
    return false
  }
  const pending = frag.pending
  if (pending) {
    // back on the mounted branch: nothing to render (a leaving fragment's
    // own branch holds no mounted key)
    if (key === pending.prevKey && !frag.leaving) {
      frag.pending = undefined
    } else {
      pending.render = render
      pending.key = key
      pending.noScope = noScope
      pending.branchKey = branchKey
    }
  } else {
    frag.pending = { render, key, noScope, branchKey, prevKey }
    if (sibling) {
      ;(transition.state.siblingEnter ||= []).push(frag)
      queueSiblingSettle(transition)
    }
  }
  return true
}

// a sibling root flipping invalid: one beside it may render in this flush,
// as in the one render vdom resolves the slot in
function deferSlotRootFlipImpl(frag: DynamicFragment): boolean {
  const hooks = frag.$transition!
  if (
    // the flip to valid: the branch is in place
    !frag.wasValid ||
    !isVaporTransitionHooks(hooks) ||
    !holdsForSiblings(frag, hooks)
  ) {
    return false
  }
  ;(hooks.state.siblingDirty ||= []).push(frag.slotBoundary!)
  queueSiblingSettle(hooks)
  return true
}

// a root beside others under the Transition (collectArrayTransitionBlocks)
function isSiblingRoot(frag: DynamicFragment): boolean {
  const ctx = frag.$keyCtx
  return !!ctx && !!ctx.siblings && !isVaporSlotOutlet(frag)
}

// a settle point renders deferred branches (renderResumed): a sibling root
// rendering there decides at once
let settling = false

// a sibling root deciding with its siblings at the settle point
function holdsForSiblings(
  frag: DynamicFragment,
  hooks: VaporTransitionHooks,
): boolean {
  return !settling && !hooks.applyGroup && isSiblingRoot(frag)
}

// Renders the deferred update `frag` holds (renderResumed)
function renderPending(frag: DynamicFragment): SlotBoundaryContext | null {
  const pending = frag.pending
  // updated past meanwhile, or in a branch a fragment rendered before replaced
  if (!pending || !frag.anchor.parentNode) return null
  frag.pending = undefined
  const { render, key, noScope, branchKey, prevKey } = pending
  // back on the mounted key, the deferred update runs as a regular one
  frag.current = prevKey
  return renderResumed(frag, frag.renderInstance, () =>
    runWithRenderCtx(frag, () => frag.update(render, key, noScope, branchKey)),
  )
}

// Renders what `frag` holds after a leave. The outlet the fragment reports to
// sees the branch once it is in place: an outlet inside it notifies while it
// renders, with the nodes that left still empty (an enclosing outlet would
// resolve its fallback for them), so it is returned to recheck once the
// fragments rendering together are all in place (recheckBoundaries). Like a
// render job, an error is reported as the owner's update error instead of
// being thrown out of the leave's done().
function renderResumed(
  frag: DynamicFragment,
  instance: GenericComponentInstance | null,
  render: () => void,
): SlotBoundaryContext | null {
  const boundary = frag.slotBoundary
  callWithErrorHandling(
    () => {
      const prevNotify = setSettlingNotify(boundary && boundary.markDirty)
      const prevSettling = settling
      settling = true
      try {
        render()
      } finally {
        settling = prevSettling
        setSettlingNotify(prevNotify)
      }
    },
    instance,
    ErrorCodes.COMPONENT_UPDATE,
  )
  return boundary
}

// An error from a fallback a recheck renders is the owner's, like the
// branch's (renderResumed)
function recheckBoundaries(
  owner: GenericComponentInstance | null,
  boundaries: (SlotBoundaryContext | null)[],
): void {
  if (!boundaries.length) return
  callWithErrorHandling(
    () => {
      for (let i = 0; i < boundaries.length; i++) {
        const boundary = boundaries[i]
        if (boundary && boundaries.indexOf(boundary) === i) {
          boundary.markDirty()
        }
      }
    },
    owner,
    ErrorCodes.COMPONENT_UPDATE,
  )
}

// the roots render in the Transition's render frame: its instance owns the
// job, after every render effect of the flush (an error is handled as its
// update's, flushJobs)
function queueSiblingSettle(hooks: VaporTransitionHooks): void {
  const { state, instance } = hooks
  let job = state.siblingJob
  if (!job) {
    job = state.siblingJob = () => settleSiblingRoots(state, instance)
    job.i = instance
  }
  queueJob(job, instance.uid, false, instance.effectCount)
}

function settleSiblingRoots(
  state: VaporTransitionState,
  owner: VaporComponentInstance,
): void {
  const left = state.siblingLeave
  const entering = state.siblingEnter
  // the outlets of the roots that flipped invalid report with the rendered ones
  const dirty = state.siblingDirty
  state.siblingLeave = state.siblingEnter = state.siblingDirty = undefined
  if (state.isUnmounting) return
  const boundaries: (SlotBoundaryContext | null)[] = []
  if (entering) {
    // out-in: paired after all, the roots entering wait on the leave; the
    // leaving root's afterLeave renders what they hold then, and the slots
    // decide on their fallbacks after that
    if (
      left &&
      left.leaving &&
      awaitLeavingRoot(left, () => recheckBoundaries(owner, dirty || []))
    ) {
      return
    }
    for (let i = 0; i < entering.length; i++) {
      boundaries.push(renderPending(entering[i]))
    }
  }
  recheckBoundaries(owner, dirty ? boundaries.concat(dirty) : boundaries)
}

// the fragment whose branch is leaving on its own (out-in, to nothing)
function findLeavingFragment(block: Block): DynamicFragment | undefined {
  let leaving: DynamicFragment | undefined
  findTransitionBlock(block, frag => {
    if ((frag as DynamicFragment).leaving) leaving = frag as DynamicFragment
  })
  return leaving
}

// A fallback committed under out-in waits on the leave a root of the content
// is still running on its own when it has a child to animate: a component is
// one however empty its root, as to vdom. An interop host patching vnode
// content finds that leave itself.
function awaitLeavingRootImpl(
  fallback: Block,
  state: SlotResolutionState,
  cb: () => void,
): boolean {
  if (!findTransitionBlock(fallback) && !hasComponent(fallback)) return false
  if (isInteropEnabled && state.awaitLeavingRoot) {
    return state.awaitLeavingRoot(cb)
  }
  return awaitLeavingRoot(state.getContent(), cb)
}

function awaitLeavingRoot(block: Block, cb: () => void): boolean {
  const leavingFrag = findLeavingFragment(block)
  if (!leavingFrag) return descendToLeavingRoot(block, cb)
  const root = findTransitionBlock(leavingFrag.nodes)
  // the hooks running the root's leave: an element's removal leave, or the
  // ones a component or interop root was handed to leave under
  const running =
    root && (root instanceof Element ? root.$removing : root.$transition)
  if (!running) return false
  // paired after all: the Transition's other branches wait on the leave as
  // well, as under vdom's out-in, until it ends. A vdom Transition (hooks
  // shaped for a vapor slot) re-renders on its own state: left to it.
  chainAfterLeave(
    running,
    cb,
    running.instance.vapor ? running.state : undefined,
  )
  return true
}

// No root of `block` is leaving: an outlet exposing a fallback of its own,
// below any structural wrapper, has the root that left in its content (vnode
// content leaves it itself). A fragment's own nodes were walked with it.
function descendToLeavingRoot(block: Block, cb: () => void): boolean {
  if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      const b = block[i]
      if ((isArray(b) || isFragment(b)) && awaitLeavingRoot(b, cb)) {
        return true
      }
    }
    return false
  }
  if (!isFragment(block)) return false
  if (!block.getContent) return descendToLeavingRoot(block.nodes, cb)
  if (
    isInteropEnabled &&
    block.awaitLeavingRoot &&
    block.awaitLeavingRoot(cb)
  ) {
    return true
  }
  // an interop host is the child itself to the walk above: the root that
  // left may be its own exposed fallback's (nodes), not in its content
  const content = block.getContent()
  return (
    awaitLeavingRoot(content, cb) ||
    (block.nodes !== content && awaitLeavingRoot(block.nodes, cb))
  )
}

// `cb` follows the leave `hooks` run; given `state`, its Transition's other
// branches wait on that leave meanwhile (out-in)
function chainAfterLeave(
  hooks: VaporTransitionHooks,
  cb: () => void,
  state?: TransitionState,
): void {
  if (state) state.isLeaving = true
  const prevAfterLeave = hooks.afterLeave
  hooks.afterLeave = () => {
    if (state) state.isLeaving = false
    if (prevAfterLeave) prevAfterLeave()
    cb()
  }
}

function removeBranchWithLeaveImpl(
  frag: DynamicFragment,
  transition: VaporTransitionHooks,
  parent: ParentNode,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
  branchKey: any,
): boolean {
  const mode = transition.mode
  // A slot root leaving empty is vdom's comment child: out-in holds nothing
  // for it. Its outlet resolves the fallback at once (the root counts as
  // invalid from here, isValidBlock), and a fallback with a child to animate
  // waits on this leave there (commitSlotFallback).
  const emptySlotRoot = !render && !!(frag.__vf & SLOT_ROOT)
  const siblingRoot = !!mode && !render && isSiblingRoot(frag)
  const persisted = isVaporSlotOutlet(frag)
    ? resolveOutletLeaveImpl(frag, frag.nodes, transition)
    : transition.persisted
  if (
    mode &&
    ownsMode(transition, frag) &&
    // persisted roots are toggled in place; mode only sequences structural
    // swaps, and a skipped persisted leave would never fire afterLeave.
    !persisted &&
    // in-out only works when there is an incoming branch to trigger
    // delayedLeave; otherwise the current branch should leave immediately.
    // A slot root leaving empty may have a fallback entering for it, its
    // outlet's or an enclosing one's, decided afterwards: its leave waits
    // on the Transition for that, and runs after the flush otherwise.
    (mode !== 'in-out' || render || emptySlotRoot || siblingRoot) &&
    // out-in only needs to defer when the current branch actually has
    // a rendered child to leave before mounting the next one.
    (mode !== 'out-in' || isValidBlock(frag.nodes))
  ) {
    const instance = currentInstance
    let enterHooks = transition
    if (mode === 'in-out' && render) {
      // The current child's hooks may still hold the handoff its own pending
      // enter will run. Hand this leave to the incoming branch through a copy.
      enterHooks = frag.$transition = extend({}, transition)
    }
    let own: DynamicFragment['pending']
    const afterLeave = () => {
      // a leave the fragment rendered past (unpaired) holds no branch of its
      // own any more: the one a later leave holds is that leave's to release
      const current = frag.pending === own
      if (current) frag.leaving = false
      // The Transition unmounted meanwhile: the pending branch must not be
      // rendered into the torn-down tree.
      if (transition.state.isUnmounting) return
      // The branch has left: an enclosing teardown must not leave it again.
      // A branch rendered meanwhile (held, this leave unpaired) is in place.
      const pending = current ? frag.pending : undefined
      if (pending) frag.nodes = EMPTY_BLOCK
      // Like vdom rendering Transition's latest child after the leave, the
      // fragments that switched meanwhile render, outermost first: the walk
      // reads a fragment's nodes after the callback, so the inner ones an
      // outer switch replaced are never reached. One leaving as it renders
      // holds the rest until its own leave ends
      const boundaries: (SlotBoundaryContext | null)[] = []
      findTransitionBlock(transition.state.root!, f => {
        const switched = f as DynamicFragment
        // a fragment leaving on its own holds its next branch, not a switch
        if (
          switched.pending &&
          switched !== frag &&
          !switched.leaving &&
          !transition.state.isLeaving
        ) {
          boundaries.push(renderPending(switched))
        }
      })
      if (pending) {
        frag.pending = undefined
        // where the fragment is now: an outer switch may have replaced it, a
        // KeepAlive may have moved it meanwhile
        const liveParent = frag.anchor.parentNode
        if (liveParent) {
          // By the time this deferred out-in branch runs, the renderEffect
          // has finished and currentInstance may have changed, so restore
          // the captured instance.
          const prevInstance = setCurrentInstance(instance)
          try {
            boundaries.push(
              renderResumed(frag, instance, () =>
                frag.renderBranch(
                  pending.render,
                  transition,
                  liveParent,
                  pending.key,
                  pending.noScope,
                  true,
                  undefined,
                  pending.branchKey,
                ),
              ),
            )
          } finally {
            restoreCurrentInstance(prevInstance)
          }
        }
      }
      recheckBoundaries(instance, boundaries)
    }
    if (
      applyTransitionLeaveHooksImpl(
        frag.nodes,
        enterHooks,
        afterLeave,
        !render && (mode === 'out-in' || mode === 'in-out'),
        frag,
      ) &&
      mode === 'out-in'
    ) {
      // out-in owns the removal here so update() can return before
      // rendering; the next branch mounts from the afterLeave callback. The
      // branch it holds tells a leave reusing this one whether one follows.
      frag.leaving = true
      frag.pending = own = { render, key, noScope, branchKey }
      remove(frag.nodes, parent)
      // a sibling root's outlet decides with its siblings (settleSiblingRoots)
      if (siblingRoot) {
        const { state } = transition
        state.siblingLeave = frag
        if (emptySlotRoot) {
          ;(state.siblingDirty ||= []).push(frag.slotBoundary!)
        }
        queueSiblingSettle(transition)
      } else if (emptySlotRoot) {
        frag.slotBoundary!.markDirty()
      }
      return true
    }
  }
  return false
}

// vdom identity of a transition child as the chain is walked: the first
// component or element is the child vnode, so its own key (or the default
// key of its branch) and its type are final; `type` set means finalized.
// Recorded per fragment so a branch re-render starting there resolves the
// same way as a walk from the Transition root.
export interface KeyContext {
  key: any
  type?: any
  // under a slot outlet's branch or a keyed v-for row: keys compose under its
  // key, as the keys under vdom's slot and keyed v-for fragments compose
  // under theirs
  slot?: boolean
  // one of several roots beside each other: vdom's one child, swapping
  siblings?: boolean
  // the position of an unkeyed root among them, its key then
  index?: number
}
export const ROOT_KEY_CONTEXT: KeyContext = { key: undefined }
// fragments that re-apply hooks on their own content, i.e. read this back
const KEY_CONTEXT_OWNER = DYNAMIC | TELEPORT

export function transitionTypeOf(block: VaporComponentInstance): any {
  return (
    (isAsyncComponentEnabled && (block.type as any).__asyncResolved) ||
    block.type
  )
}

// vdom keys a slot's fragment `_<name>`, its fallback's `_<name>_fb`, and
// composes the keys under them: the content, the fallback and the fallbacks
// of the outlets inside either never early-remove each other's leave. An
// interop outlet has no name here; its fallback still keys apart.
function enterSlotKeyContext(
  ctx: KeyContext,
  outlet: VaporFragment | undefined,
  fallback: boolean,
): KeyContext {
  if (ctx.type) return ctx
  const name = outlet && outlet.slotName
  if (name === undefined && !fallback) return ctx
  const key = (name === undefined ? '' : '_' + name) + (fallback ? '_fb' : '')
  return { key: ownKey(ctx, key), slot: true, siblings: ctx.siblings }
}

// vdom keys the children of a keyed `<template v-for>` row under the row key,
// as under a slot's; an unkeyed row composes nothing
export function enterRowKeyContext(ctx: KeyContext, key: any): KeyContext {
  if (ctx.type || key == null) return ctx
  return { key: ownKey(ctx, key), slot: true, siblings: ctx.siblings }
}

// The context the roots of `block` beside each other share under a composing
// `ctx`: vdom keys a fragment's unkeyed children by their position (each
// root's `index`), and roots beside each other anywhere under a slot swap as
// its one child.
export function enterRootsKeyContext(
  ctx: KeyContext,
  block: Block[],
): KeyContext {
  let n = 0
  for (let i = 0; i < block.length; i++) {
    if (!(block[i] instanceof Comment)) n++
  }
  return {
    key: ownKey(ctx, undefined),
    slot: true,
    siblings: n > 1 || !!ctx.siblings,
  }
}

export function rootKeyContext(roots: KeyContext, index: number): KeyContext {
  return { key: roots.key, slot: true, siblings: roots.siblings, index }
}

// a block's own key in `ctx`
function ownKey(ctx: KeyContext, key: any): any {
  if (key == null) {
    // the position of an unkeyed root, apart from the generated keys of the
    // branches beside it (createIf keys the branches of a chain only)
    return ctx.index === undefined ? ctx.key : ctx.key + '.' + ctx.index
  }
  return ctx.slot ? ctx.key + String(key) : key
}

export function withDefaultKey(ctx: KeyContext, key: any): KeyContext {
  return ctx.type || key == null
    ? ctx
    : { key: ownKey(ctx, key), slot: ctx.slot, siblings: ctx.siblings }
}

function isUnresolvedAsyncWrapper(block: VaporComponentInstance): boolean {
  return (
    isAsyncComponentEnabled &&
    isAsyncWrapper(block) &&
    getAsyncWrapperInner(block) === undefined
  )
}

// The context a component hands to its content: finalized to the component's
// identity, except for an unresolved async wrapper, whose resolved child
// finalizes it later with the wrapper key as default.
export function enterComponentKeyContext(
  ctx: KeyContext,
  block: VaporComponentInstance,
  unresolved: boolean = isUnresolvedAsyncWrapper(block),
): KeyContext {
  if (ctx.type) return ctx
  return unresolved
    ? withDefaultKey(ctx, block.$key)
    : { key: ownKey(ctx, block.$key), type: transitionTypeOf(block) }
}

// Records the context a fragment's content resolves in and returns that
// content's context, `key` being the fragment's own default key.
export function enterFragmentKeyContext(
  frag: VaporFragment,
  ctx: KeyContext,
  key: any = getFragmentKey(frag),
): KeyContext {
  if (frag.__vf & KEY_CONTEXT_OWNER) frag.$keyCtx = ctx
  return withDefaultKey(ctx, key)
}

function resolveChildIdentity(
  child: ResolvedTransitionBlock,
  ctx: KeyContext,
): void {
  child.$tkey = ctx.type ? ctx.key : ownKey(ctx, child.$key)
  if (ctx.type) child.$ttype = ctx.type
}

/**
 * Resolve the transition child of `block` together with its identity.
 * `owner` is the fragment whose content `block` is.
 */
export function resolveTransitionBlock(
  block: Block,
  onFragment?: (target: HooksTarget) => void,
  owner?: VaporFragment,
  ctx?: KeyContext,
): ResolvedTransitionBlock | undefined {
  if (!ctx) {
    ctx = owner
      ? withDefaultKey(owner.$keyCtx || ROOT_KEY_CONTEXT, getFragmentKey(owner))
      : ROOT_KEY_CONTEXT
    // a slot outlet's branch, applied by the outlet itself
    ctx = enterSlotKeyContext(ctx, owner, isSlotFallbackBlock(block))
  }
  const children: ResolvedTransitionBlock[] = []
  collectTransitionBlocks(block, onFragment, children, ctx)
  return children[0]
}

/** Locate the transition child of `block` without touching its identity. */
export function findTransitionBlock(
  block: Block,
  onFragment?: (target: HooksTarget) => void,
): ResolvedTransitionBlock | undefined {
  const children: ResolvedTransitionBlock[] = []
  collectTransitionBlocks(block, onFragment, children, undefined)
  return children[0]
}

// `ctx` undefined: locate only
function collectTransitionBlocks(
  block: Block,
  onFragment: ((target: HooksTarget) => void) | undefined,
  children: ResolvedTransitionBlock[],
  ctx: KeyContext | undefined,
): void {
  if (block instanceof Node) {
    // transition can only be applied on Element child
    if (block instanceof Element) {
      children.push(block)
      if (ctx) resolveChildIdentity(block, ctx)
    }
  } else if (isVaporComponent(block)) {
    collectComponentTransitionBlocks(block, onFragment, children, ctx)
  } else if (isArray(block)) {
    collectArrayTransitionBlocks(block, onFragment, children, ctx)
  } else if (isFragment(block)) {
    collectFragmentTransitionBlocks(block, onFragment, children, ctx)
  }
}

function collectComponentTransitionBlocks(
  block: VaporComponentInstance,
  onFragment: ((target: HooksTarget) => void) | undefined,
  children: ResolvedTransitionBlock[],
  ctx: KeyContext | undefined,
): void {
  // vdom's getInnerChild: KeepAlive is looked through, its child is the one
  if (isKeepAliveEnabled && isKeepAlive(block)) {
    collectTransitionBlocks(block.block, onFragment, children, ctx)
    return
  }
  // An async setup renders the root once it resolves: the component keeps the
  // hooks until then, as vdom's root inherits them from the component vnode.
  if (
    __FEATURE_SUSPENSE__ &&
    isSuspenseEnabled &&
    block.asyncDep &&
    !block.asyncResolved
  ) {
    if (onFragment) {
      onFragment(block)
      resolveRootAfterSetup(block, ctx)
    }
    return
  }
  const async = isAsyncComponentEnabled && isAsyncWrapper(block)
  const inner = async ? getAsyncWrapperInner(block) : undefined
  if (ctx) {
    ctx = enterComponentKeyContext(ctx, block, async && inner === undefined)
  }
  if (async) {
    if (inner === undefined) {
      // unresolved: the wrapper's fragment re-renders the resolved child
      if (isFragment(block.block)) {
        if (onFragment) onFragment(block.block)
        if (ctx) block.block.$keyCtx = ctx
      }
      return
    }
    collectTransitionBlocks(inner, onFragment, children, ctx)
    return
  }

  // stop searching if encountering nested Transition component
  if (isVaporTransition(block.type)) return

  collectTransitionBlocks(block.block, onFragment, children, ctx)
}

// `ctx` undefined: hooks relayed from a vdom Transition, resolving no identity
function resolveRootAfterSetup(
  instance: VaporComponentInstance & TransitionOptions,
  ctx: KeyContext | undefined,
): void {
  // one callback per instance: a later walk only updates the context it uses
  if (!instance.$keyCtx) {
    ;(instance.bm ||= []).push(() => {
      const hooks = instance.$transition
      if (hooks) {
        instance.$transition = undefined
        applyTransitionHooksImpl(
          instance,
          hooks,
          undefined,
          false,
          instance.$keyCtx,
        )
      }
    })
    instance.$keyCtx = ctx || ROOT_KEY_CONTEXT
  } else if (ctx) {
    instance.$keyCtx = ctx
  }
}

function collectArrayTransitionBlocks(
  block: Block[],
  onFragment: ((target: HooksTarget) => void) | undefined,
  children: ResolvedTransitionBlock[],
  ctx: KeyContext | undefined,
): void {
  let hasFound = false
  // under a composing key: vdom flattens the fragments under the slot, so
  // roots beside each other anywhere in them swap, and a nested array
  // composes under its position
  const roots = ctx && ctx.slot ? enterRootsKeyContext(ctx, block) : undefined
  for (let i = 0; i < block.length; i++) {
    const c = block[i]
    if (c instanceof Comment) continue
    const nested: ResolvedTransitionBlock[] = []
    collectTransitionBlocks(
      c,
      onFragment,
      nested,
      roots ? rootKeyContext(roots, i) : ctx,
    )
    // a root rendering nothing is no child, like a comment in vdom; its
    // fragments still take the hooks for what it renders later
    if (!nested.length) continue
    if (hasFound) {
      if (__DEV__) {
        // warn more than one non-comment child
        warn(
          '<transition> can only be used on a single element or component. ' +
            'Use <transition-group> for lists.',
        )
      }
      break
    }
    children.push(nested[0])
    hasFound = true
  }
}

function collectFragmentTransitionBlocks(
  block: VaporFragment,
  onFragment: ((target: HooksTarget) => void) | undefined,
  children: ResolvedTransitionBlock[],
  ctx: KeyContext | undefined,
): void {
  if (isInteropEnabled && block.hasVDOMContent && block.hasVDOMContent()) {
    children.push(block)
    if (ctx) {
      resolveChildIdentity(block, ctx)
      if (!ctx.type) {
        const type = block.getTransitionType!()
        if (type !== undefined) block.$ttype = type
      }
    }
    return
  }

  // collect fragments for setting transition hooks
  if (onFragment) onFragment(block)
  let contentCtx = ctx && enterFragmentKeyContext(block, ctx)
  if (contentCtx && isSlotOutletFragment(block)) {
    contentCtx = enterSlotKeyContext(
      contentCtx,
      block,
      isSlotFallbackBlock(block.nodes),
    )
  }
  collectTransitionBlocks(block.nodes, onFragment, children, contentCtx)
}

export function isValidTransitionBlock(
  block: Block,
): block is ResolvedTransitionBlock {
  return (
    block instanceof Element ||
    !!(
      isInteropEnabled &&
      isFragment(block) &&
      block.hasVDOMContent &&
      block.hasVDOMContent()
    )
  )
}

export function getTransitionElement(
  block: ResolvedTransitionBlock,
): Element | undefined {
  if (block instanceof Element) return block

  // vdom interop
  if (isInteropEnabled && isFragment(block) && block.getTransitionElement) {
    return block.getTransitionElement()
  }
}
