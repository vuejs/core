import {
  type BaseTransitionProps,
  type GenericComponentInstance,
  type TransitionElement,
  type TransitionHooks,
  type TransitionHooksContext,
  type TransitionProps,
  TransitionPropsValidators,
  type TransitionState,
  baseResolveTransitionHooks,
  checkTransitionMode,
  currentInstance,
  isAsyncWrapper,
  isTemplateNode,
  leaveCbKey,
  onBeforeMount,
  queuePostFlushCb,
  resolveTransitionProps,
  setCurrentInstance,
  useTransitionState,
  vShowOriginalDisplay,
  warn,
} from '@vue/runtime-dom'
import { computed } from '@vue/reactivity'
import {
  type Block,
  type BlockFn,
  type TransitionBlock,
  type TransitionOptions,
  type VaporTransitionHooks,
  isValidBlock,
  remove,
} from '../block'
import {
  displayName,
  getInteropTransitionElement,
  getInteropTransitionType,
  isVaporTransition,
  registerTransitionHooks,
} from '../transition'
import {
  type FunctionalVaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'
import {
  DynamicFragment,
  type VaporFragment,
  isDynamicFragment,
  isForFragment,
  isFragment,
  isSlotFragment,
} from '../fragment'
import {
  currentHydrationNode,
  isHydrating,
  setCurrentHydrationNode,
} from '../dom/hydration'
import { type PendingVShow, setCurrentPendingVShows } from '../directives/vShow'
import { isInteropEnabled } from '../vdomInteropState'

export type ResolvedTransitionBlock = (
  | Element
  | VaporFragment
  | DynamicFragment
) &
  TransitionOptions

let registered = false
export const ensureTransitionHooksRegistered = (): void => {
  if (!registered) {
    registered = true
    registerTransitionHooks(
      applyTransitionHooksImpl,
      deferBranchUpdateDuringLeaveImpl,
      removeBranchWithLeaveImpl,
    )
  }
}

const hydrateTransitionImpl = () => {
  if (!currentHydrationNode || !isTemplateNode(currentHydrationNode)) return
  // replace <template> node with inner child
  const { content, parentNode } = currentHydrationNode
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

    parentNode!.insertBefore(content, currentHydrationNode)
    parentNode!.removeChild(currentHydrationNode)
    setCurrentHydrationNode(firstChild)

    if (
      transitionEl instanceof HTMLElement ||
      transitionEl instanceof SVGElement
    ) {
      const originalDisplay = transitionEl.style.display
      transitionEl.style.display = 'none'

      return (hooks: TransitionHooks) => {
        hooks.beforeEnter(transitionEl)
        transitionEl.style.display = originalDisplay
        queuePostFlushCb(() => hooks.enter(transitionEl))
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

    const performAppear = isHydrating ? hydrateTransitionImpl() : undefined
    const state = useTransitionState()
    const instance = currentInstance! as VaporComponentInstance
    const { mode } = props
    __DEV__ && checkTransitionMode(mode)

    const resolvedProps = computed(() => resolveTransitionProps(props))
    const propsProxy = new Proxy({} as BaseTransitionProps<Element>, {
      get(_, key) {
        return resolvedProps.value[key as keyof BaseTransitionProps<Element>]
      },
    })

    const shouldCaptureVShow = !isHydrating && !!props.appear
    const shouldPerformAppear = !!props.appear && !!performAppear
    // Dynamic slot sources can add/remove the default slot after setup, so
    // Transition needs a DynamicFragment to drive enter/leave on updates.
    if (instance.rawSlots.$) {
      const frag = new DynamicFragment('transition')
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
        const [, pendingVShows] = capturePendingVShows(
          shouldCaptureVShow && !isMounted,
          () => frag.update(slots.default),
        )
        let hasStructuralRoot = false
        const root = resolveTransitionBlock(frag.nodes, fragment => {
          hasStructuralRoot ||= isStructuralTransitionFragment(fragment)
        })
        applyPendingVShows(
          frag.$transition!,
          root,
          pendingVShows,
          hasStructuralRoot,
        )
        if (!isMounted && shouldPerformAppear) performAppear(frag.$transition!)
        isMounted = true
      })
      return frag
    }

    const [children, pendingVShows] = capturePendingVShows(
      shouldCaptureVShow,
      () => ((slots.default && slots.default()) || []) as any as Block,
    )

    let appliedHooks = {
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
    // re-resolve. Reusing appliedHooks preserves runtime state (persisted /
    // delayedLeave) across re-resolves.
    renderEffect(() => {
      const { hooks, root, hasStructuralRoot } = applyResolvedTransitionHooks(
        children,
        appliedHooks,
      )
      appliedHooks = hooks
      if (!isMounted) {
        isMounted = true
        applyPendingVShows(hooks, root, pendingVShows, hasStructuralRoot)
        if (shouldPerformAppear) performAppear(hooks)
      }
    })
    return children
  })

const transitionTypeMap = new WeakMap<ResolvedTransitionBlock, any>()

function getTransitionType(block: ResolvedTransitionBlock): any {
  const type = transitionTypeMap.get(block)
  if (type !== undefined) return type
  if (block instanceof Element) return block.localName
  if (isInteropEnabled && isFragment(block) && block.vnode) {
    const type = getInteropTransitionType(block.vnode)
    if (type !== undefined) return type
  }
  return block
}

export function setTransitionType(
  block: ResolvedTransitionBlock,
  type: any,
): void {
  transitionTypeMap.set(block, type)
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

function getLeaveElement(
  block: ResolvedTransitionBlock,
): TransitionElement | undefined {
  const el = getTransitionElement(block)
  if (el) return el as TransitionElement
  if (
    isFragment(block) &&
    !isArray(block.nodes) &&
    (block.nodes instanceof Element || isFragment(block.nodes))
  ) {
    return getLeaveElement(block.nodes)
  }
}

const getTransitionHooksContext = (
  block: ResolvedTransitionBlock,
  props: TransitionProps,
  state: TransitionState,
  instance: GenericComponentInstance,
  postClone: ((hooks: TransitionHooks) => void) | undefined,
) => {
  const key = String(block.$key)
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
      if (leavingNode && leavingNode.$key === block.$key) {
        const el = getLeaveElement(leavingNode)
        if (el && el[leaveCbKey]) {
          // force early removal (not cancelled)
          el[leaveCbKey]!()
        }
      }
    },
    cloneHooks: block => {
      const hooks = resolveTransitionHooks(
        block,
        props,
        state,
        instance,
        postClone,
      )
      if (postClone) postClone(hooks)
      return hooks
    },
  }
  return context
}

export function resolveTransitionHooks(
  block: ResolvedTransitionBlock,
  props: TransitionProps,
  state: TransitionState,
  instance: GenericComponentInstance,
  postClone?: (hooks: TransitionHooks) => void,
): VaporTransitionHooks {
  const context = getTransitionHooksContext(
    block,
    props,
    state,
    instance,
    postClone,
  )
  const hooks = baseResolveTransitionHooks(
    context,
    props,
    state,
    instance,
  ) as VaporTransitionHooks
  hooks.state = state
  hooks.props = props
  hooks.instance = instance as VaporComponentInstance
  return hooks
}

export function applyTransitionHooksImpl(
  block: Block,
  hooks: VaporTransitionHooks,
): VaporTransitionHooks {
  return applyResolvedTransitionHooks(block, hooks).hooks
}

function applyResolvedTransitionHooks(
  block: Block,
  hooks: VaporTransitionHooks,
): {
  hooks: VaporTransitionHooks
  root?: ResolvedTransitionBlock
  hasStructuralRoot: boolean
} {
  // filter out comment nodes
  if (isArray(block)) {
    block = block.filter(b => !(b instanceof Comment))
    if (block.length === 1) {
      block = block[0]
    } else if (block.length === 0) {
      return { hooks, hasStructuralRoot: false }
    }
  }

  // Delegate list/root-slot wrappers back to TransitionGroup's apply logic.
  // Other fragment shapes, such as keyed v-if branches, still need normal
  // enter/leave hooks for their resolved single child.
  if (
    hooks.applyGroup &&
    (isForFragment(block) ||
      isSlotFragment(block) ||
      (isVaporComponent(block) && isSlotFragment(block.block)))
  ) {
    hooks.applyGroup(block, hooks.props, hooks.state, hooks.instance)
    return { hooks, hasStructuralRoot: false }
  }

  const fragments: VaporFragment[] = []
  let hasStructuralRoot = false
  const child = resolveTransitionBlock(block, fragment => {
    fragments.push(fragment)
    hasStructuralRoot ||= isStructuralTransitionFragment(fragment)
  })
  if (!child) {
    // set transition hooks on fragments for later use
    fragments.forEach(f => (f.$transition = hooks))
    // warn if no child and no fragments
    if (__DEV__ && fragments.length === 0) {
      warn('Transition component has no valid child element')
    }
    return { hooks, hasStructuralRoot }
  }

  const { props, instance, state, delayedLeave } = hooks
  let resolvedHooks = resolveTransitionHooks(
    child,
    props,
    state,
    instance,
    hooks => (resolvedHooks = hooks as VaporTransitionHooks),
  )
  // Dynamic slot / branch swaps replace the active hook object. The previously
  // derived persisted state (slot/component-root v-show, detected only at mount
  // via applyPendingVShows) must carry forward when the new root is *also* a
  // v-show root, but must NOT leak onto a structural root — otherwise that
  // root's removal would wrongly skip its leave animation. Gating the
  // carry-forward on both the current root's v-show marker and its ownership
  // keeps the latch tied to the live root; mount/non-appear paths are untouched
  // because they never have a latched `hooks.persisted` to carry.
  resolvedHooks.persisted =
    resolvedHooks.persisted ||
    (!hasStructuralRoot && hooks.persisted && hasVShowMarker(child))
  resolvedHooks.delayedLeave = delayedLeave
  child.$transition = resolvedHooks
  fragments.forEach(f => (f.$transition = resolvedHooks))

  return {
    hooks: resolvedHooks,
    root: child,
    hasStructuralRoot,
  }
}

function isStructuralTransitionFragment(fragment: VaporFragment): boolean {
  return !!(
    isDynamicFragment(fragment) &&
    !isSlotFragment(fragment) &&
    fragment.inTransition
  )
}

function applyTransitionLeaveHooksImpl(
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
): void {
  const leavingBlock = resolveTransitionBlock(block)
  if (!leavingBlock) return undefined

  const { props, state, instance } = enterHooks
  const leavingHooks = resolveTransitionHooks(
    leavingBlock,
    props,
    state,
    instance,
  )
  leavingBlock.$transition = leavingHooks

  const { mode } = props
  if (mode === 'out-in') {
    state.isLeaving = true
    leavingHooks.afterLeave = () => {
      state.isLeaving = false
      afterLeaveCb()
      leavingBlock.$transition = undefined
      delete leavingHooks.afterLeave
    }
  } else if (mode === 'in-out') {
    leavingHooks.delayLeave = (
      block: TransitionElement,
      earlyRemove,
      delayedLeave,
    ) => {
      const leavingNodes = getLeavingNodesForType(state, leavingBlock)
      const leavingKey = String(leavingBlock.$key)
      leavingNodes[leavingKey] = leavingBlock
      // Bind cleanup to this specific handoff so an older leave callback
      // cannot clear a newer delayedLeave during rapid toggles.
      const delayedLeaveCb = () => {
        delayedLeave()
        leavingBlock.$transition = undefined
        if (enterHooks.delayedLeave === delayedLeaveCb) {
          delete enterHooks.delayedLeave
        }
      }
      // early removal callback
      block[leaveCbKey] = () => {
        earlyRemove()
        block[leaveCbKey] = undefined
        leavingBlock.$transition = undefined
        // Same-key in-out switches early-remove the previous leaving block.
        // Clear the cache entry so the next enter isn't skipped as "still leaving".
        if (leavingNodes[leavingKey] === leavingBlock) {
          delete leavingNodes[leavingKey]
        }
        if (enterHooks.delayedLeave === delayedLeaveCb) {
          delete enterHooks.delayedLeave
        }
      }
      enterHooks.delayedLeave = delayedLeaveCb
    }
  }
}

function deferBranchUpdateDuringLeaveImpl(
  frag: DynamicFragment,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
): boolean {
  const transition = frag.$transition!
  if (!transition.state.isLeaving) return false
  // Track the latest target key immediately so repeated updates during
  // leave keep overwriting the pending branch instead of reviving stale
  // keys when the deferred render finally runs.
  frag.current = key
  const pending = frag.pending
  if (pending) {
    pending.render = render
    pending.key = key
    pending.noScope = noScope
  } else {
    frag.pending = { render, key, noScope }
  }
  return true
}

function removeBranchWithLeaveImpl(
  frag: DynamicFragment,
  transition: VaporTransitionHooks,
  parent: ParentNode | null,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
): boolean {
  const mode = transition.mode
  if (
    mode &&
    // in-out only works when there is an incoming branch to trigger
    // delayedLeave; otherwise the current branch should leave immediately.
    (mode !== 'in-out' || render) &&
    // out-in only needs to defer when the current branch actually has
    // a rendered child to leave before mounting the next one.
    (mode !== 'out-in' || isValidBlock(frag.nodes))
  ) {
    const instance = currentInstance
    applyTransitionLeaveHooksImpl(frag.nodes, transition, () => {
      // By the time this deferred out-in branch runs, the renderEffect
      // has finished and currentInstance may have changed, so restore
      // the captured instance.
      const prevInstance = setCurrentInstance(instance)
      try {
        const pending = frag.pending
        if (pending) {
          frag.pending = undefined
          frag.renderBranch(
            pending.render,
            transition,
            parent,
            pending.key,
            pending.noScope,
            true,
          )
        } else {
          frag.renderBranch(render, transition, parent, key, noScope, true)
        }
      } finally {
        setCurrentInstance(...prevInstance)
      }
    })
    if (mode === 'out-in') {
      // out-in owns the removal here so update() can return before
      // rendering; the next branch mounts from the afterLeave callback.
      // Record the target key immediately (mirroring the defer path) so
      // `current` no longer points at the outgoing branch. Otherwise a
      // toggle back to the original key during the leave would hit the
      // `key === current` early-return in update() and be dropped, leaving
      // the deferred render to mount the stale branch.
      frag.current = key
      parent && remove(frag.nodes, parent)
      return true
    }
  }
  return false
}

export function resolveTransitionBlock(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
): ResolvedTransitionBlock | undefined {
  const children: ResolvedTransitionBlock[] = []
  collectTransitionBlocks(block, onFragment, children)
  return children[0]
}

function collectTransitionBlocks(
  block: Block,
  onFragment: ((frag: VaporFragment) => void) | undefined,
  children: ResolvedTransitionBlock[],
): void {
  if (block instanceof Node) {
    // transition can only be applied on Element child
    if (block instanceof Element) children.push(block)
  } else if (isVaporComponent(block)) {
    collectComponentTransitionBlocks(block, onFragment, children)
  } else if (isArray(block)) {
    collectArrayTransitionBlocks(block, onFragment, children)
  } else if (isFragment(block)) {
    collectFragmentTransitionBlocks(block, onFragment, children)
  }
}

function collectComponentTransitionBlocks(
  block: VaporComponentInstance,
  onFragment: ((frag: VaporFragment) => void) | undefined,
  children: ResolvedTransitionBlock[],
): void {
  if (isAsyncWrapper(block)) {
    // for unresolved async wrapper, set transition hooks on inner fragment
    if (!block.type.__asyncResolved) {
      if (onFragment) onFragment(block.block! as DynamicFragment)
      return
    }

    const start = children.length
    collectTransitionBlocks(
      (block.block! as DynamicFragment).nodes,
      onFragment,
      children,
    )
    inheritSingleComponentKey(children[start], block)
    return
  }

  // stop searching if encountering nested Transition component
  if (isVaporTransition(block.type)) return

  const start = children.length
  collectTransitionBlocks(block.block, onFragment, children)
  inheritSingleComponentKey(children[start], block)
}

function collectArrayTransitionBlocks(
  block: Block[],
  onFragment: ((frag: VaporFragment) => void) | undefined,
  children: ResolvedTransitionBlock[],
): void {
  let hasFound = false
  for (const c of block) {
    if (c instanceof Comment) continue
    const nested: ResolvedTransitionBlock[] = []
    collectTransitionBlocks(c, onFragment, nested)
    if (__DEV__ && hasFound) {
      // warn more than one non-comment child
      warn(
        '<transition> can only be used on a single element or component. ' +
          'Use <transition-group> for lists.',
      )
      break
    }
    if (nested.length) children.push(nested[0])
    hasFound = true
    if (!__DEV__) break
  }
}

function collectFragmentTransitionBlocks(
  block: VaporFragment,
  onFragment: ((frag: VaporFragment) => void) | undefined,
  children: ResolvedTransitionBlock[],
): void {
  if (isInteropEnabled && block.vnode) {
    children.push(block)
    const type = getInteropTransitionType(block.vnode)
    if (type !== undefined) setTransitionType(block, type)
    return
  }

  // collect fragments for setting transition hooks
  if (onFragment) onFragment(block)
  collectTransitionBlocks(block.nodes, onFragment, children)
}

function inheritSingleComponentKey(
  child: ResolvedTransitionBlock | undefined,
  block: VaporComponentInstance,
): void {
  if (!child) return
  // Inherit an explicit component key onto the resolved child, but do NOT
  // fall back to the component uid. An unkeyed child must keep its key
  // undefined so successive instances of the same component type share the
  // leaving-cache bucket (which is keyed by resolved type). This matches
  // VDOM's null-key behavior and lets a re-entering instance early-remove
  // the previous one that is still leaving. A uid fallback gives every
  // instance a distinct key, permanently breaking earlyRemove on toggles.
  if (child.$key == null && block.$key != null) {
    child.$key = block.$key
  }
  setTransitionType(child, block.type)
}

export function setTransitionHooks(
  block: TransitionBlock,
  hooks: VaporTransitionHooks,
): void {
  if (isVaporComponent(block)) {
    block = resolveTransitionBlock(block.block) as TransitionBlock
    if (!block) return
  }
  block.$transition = hooks
}

export function isValidTransitionBlock(
  block: Block,
): block is ResolvedTransitionBlock {
  return !!(
    block instanceof Element ||
    (isInteropEnabled && isFragment(block) && block.vnode)
  )
}

export function getTransitionElement(
  block: ResolvedTransitionBlock,
): Element | undefined {
  if (block instanceof Element) return block

  // vdom interop
  if (isInteropEnabled && isFragment(block) && block.vnode) {
    return getInteropTransitionElement(block.vnode)
  }
}

function capturePendingVShows<T>(
  enabled: boolean,
  render: () => T,
): [block: T, pendingVShows: PendingVShow[] | undefined] {
  if (!enabled) {
    return [render(), undefined]
  }

  const pendingVShows: PendingVShow[] = []
  const prev = setCurrentPendingVShows(pendingVShows)
  try {
    return [render(), pendingVShows]
  } finally {
    setCurrentPendingVShows(prev)
  }
}

function applyPendingVShows(
  hooks: VaporTransitionHooks,
  root: ResolvedTransitionBlock | undefined,
  pendingVShows: PendingVShow[] | undefined,
  hasStructuralRoot: boolean,
): void {
  if (!pendingVShows) return

  if (root) {
    // Keep compiler-injected persisted for direct v-show children, and
    // additionally treat slot/component roots as persisted when their
    // deferred v-show target resolves to the same transition root.
    hooks.persisted =
      hooks.persisted ||
      (!hasStructuralRoot &&
        pendingVShows.some(
          pending =>
            pending.target === root ||
            resolveTransitionBlock(pending.target) === root,
        ))
  }

  onBeforeMount(() => {
    // Flush the deferred initial v-show display writes before mount so hooks are
    // ready, then run enter after DOM insertion but before mounted state flips.
    let enterCbs: (() => void)[] | undefined
    pendingVShows.forEach(pending => {
      const enterCb = pending.apply()
      if (enterCb) {
        ;(enterCbs ||= []).push(enterCb)
      }
    })
    pendingVShows.length = 0
    if (enterCbs) {
      const cbs = enterCbs
      queuePostFlushCb(() => cbs.forEach(cb => cb()), -1)
    }
  })
}

// Whether the resolved root is (still) a v-show-persisted element. v-show's
// setDisplay tags the leaf element with `vShowOriginalDisplay` on its first
// run, which on branch/slot updates happens during render (before hooks are
// applied), so it doubles as a "this root is persisted" marker without
// re-running the mount-only applyPendingVShows derivation.
function hasVShowMarker(block: Block | undefined): boolean {
  if (!block) return false
  if (block instanceof Element) return vShowOriginalDisplay in block
  if (isVaporComponent(block)) return hasVShowMarker(block.block)
  if (isArray(block)) return block.length === 1 && hasVShowMarker(block[0])
  if (isFragment(block)) return hasVShowMarker(block.nodes)
  return false
}
