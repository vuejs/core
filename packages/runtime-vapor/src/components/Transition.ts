import {
  type BaseTransitionProps,
  type GenericComponentInstance,
  type SuspenseBoundary,
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
  isKeepAlive,
  isTemplateNode,
  leaveCbKey,
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
  type TransitionBlock,
  type TransitionOptions,
  type VaporTransitionHooks,
  type VaporTransitionState,
  isValidBlock,
  remove,
} from '../block'
import {
  type TransitionOwner,
  displayName,
  isVaporTransition,
  registerTransitionHooks,
} from '../transition'
import {
  type FunctionalVaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { getAsyncWrapperInner } from '../apiDefineAsyncComponent'
import { isAsyncComponentEnabled } from '../asyncComponentState'
import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'
import {
  DynamicFragment,
  type VaporFragment,
  getFragmentKey,
  isDynamicFragment,
  isForFragment,
  isFragment,
  isVaporSlotOutlet,
} from '../fragment'
import { isKeepAliveEnabled } from '../keepAlive'
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

let registered = false
export const ensureTransitionHooksRegistered = (): void => {
  if (!registered) {
    registered = true
    registerTransitionHooks(
      applyTransitionHooksImpl,
      applyTransitionLeaveHooksImpl,
      deferBranchUpdateDuringLeaveImpl,
      removeBranchWithLeaveImpl,
    )
  }
}

const hydrateTransitionImpl = (suspense: SuspenseBoundary | null) => {
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

      return (hooks: TransitionHooks) => {
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
          )
        }
        if (!isMounted && shouldPerformAppear) performAppear(frag.$transition!)
        isMounted = true
      })
      return frag
    }

    const children = ((slots.default && slots.default()) || []) as any as Block
    state.root = children

    let appliedHooks = {
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
    // re-resolve. Reusing appliedHooks preserves runtime state (delayedLeave)
    // across re-resolves.
    renderEffect(() => {
      appliedHooks = applyTransitionHooksImpl(children, appliedHooks)
      if (!isMounted) {
        isMounted = true
        if (shouldPerformAppear) performAppear(appliedHooks)
      }
    })
    return children
  })

const transitionTypeMap = new WeakMap<ResolvedTransitionBlock, any>()

function getTransitionType(block: ResolvedTransitionBlock): any {
  const type = transitionTypeMap.get(block)
  if (type !== undefined) return type
  if (block instanceof Element) return block.localName
  if (isInteropEnabled && isFragment(block) && block.getTransitionType) {
    const type = block.getTransitionType()
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

// Keys resolved for transition children (vdom's `vnode.key` as seen by
// Transition / TransitionGroup), written when the content is resolved.
export const transitionKeys: WeakMap<ResolvedTransitionBlock, any> =
  new WeakMap()

export function getTransitionKey(block: ResolvedTransitionBlock): any {
  return transitionKeys.get(block)
}

const getTransitionHooksContext = (
  block: ResolvedTransitionBlock,
  state: TransitionState,
) => {
  const key = String(getTransitionKey(block))
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
      if (
        leavingNode &&
        getTransitionKey(leavingNode) === getTransitionKey(block)
      ) {
        const el = getLeaveElement(leavingNode)
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
  owner?: TransitionOwner,
): VaporTransitionHooks {
  // filter out comment nodes
  if (isArray(block)) {
    block = block.filter(b => !(b instanceof Comment))
    if (block.length === 1) {
      block = block[0]
    } else if (block.length === 0) {
      return hooks
    }
  }

  // Delegate list/root-slot wrappers back to TransitionGroup's apply logic.
  // Other fragment shapes, such as keyed v-if branches, still need normal
  // enter/leave hooks for their resolved single child.
  if (
    hooks.applyGroup &&
    (isForFragment(block) ||
      isVaporSlotOutlet(block) ||
      (isVaporComponent(block) && isVaporSlotOutlet(block.block)))
  ) {
    hooks.applyGroup(block, hooks.props, hooks.state, hooks.instance)
    return hooks
  }

  const fragments: VaporFragment[] = []
  const child = resolveTransitionBlock(
    block,
    fragment => fragments.push(fragment),
    owner,
  )
  if (!child) {
    // set transition hooks on fragments for later use
    fragments.forEach(f => (f.$transition = hooks))
    // warn if no child and no fragments
    if (__DEV__ && fragments.length === 0) {
      warn('Transition component has no valid child element')
    }
    return hooks
  }

  const { props, instance, state, delayedLeave } = hooks
  state.persisted = isPersistedRoot(state.root)
  const resolvedHooks = resolveTransitionHooks(child, props, state, instance)
  resolvedHooks.delayedLeave = delayedLeave
  child.$transition = resolvedHooks
  fragments.forEach(f => (f.$transition = resolvedHooks))
  return resolvedHooks
}

// Runtime equivalent of the compiler's persisted rule for roots the compiler
// can't see (slot content): the v-show target is reached from Transition's
// root through components and slot outlets only; a v-if / v-for / dynamic
// slot boundary before it makes the root structural. Walked from the root on
// every apply so branch swaps can't latch a stale result.
function isPersistedRoot(block: Block | undefined): boolean {
  while (block) {
    if ((block as TransitionOptions).$vshow) return true
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
      (isVaporSlotOutlet(block) ||
        !(isDynamicFragment(block) || isForFragment(block)))
    ) {
      block = block.nodes
    } else {
      return false
    }
  }
  return false
}

export function applyTransitionLeaveHooksImpl(
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
): boolean {
  const leavingBlock = findTransitionBlock(block)
  if (!leavingBlock) return false

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
      const leavingKey = String(getTransitionKey(leavingBlock))
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
  return true
}

function deferBranchUpdateDuringLeaveImpl(
  frag: DynamicFragment,
  render: BlockFn | undefined,
  key: any,
  noScope: boolean,
  branchKey: any,
): boolean {
  const transition = frag.$transition!
  if (!transition.state.isLeaving) return false
  const pending = frag.pending
  if (pending) {
    pending.render = render
    pending.key = key
    pending.noScope = noScope
    pending.branchKey = branchKey
  } else {
    frag.pending = { render, key, noScope, branchKey }
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
  branchKey: any,
): boolean {
  const mode = transition.mode
  if (
    mode &&
    // persisted roots are toggled in place; mode only sequences structural
    // swaps, and a skipped persisted leave would never fire afterLeave.
    !transition.persisted &&
    // in-out only works when there is an incoming branch to trigger
    // delayedLeave; otherwise the current branch should leave immediately.
    (mode !== 'in-out' || render) &&
    // out-in only needs to defer when the current branch actually has
    // a rendered child to leave before mounting the next one.
    (mode !== 'out-in' || isValidBlock(frag.nodes))
  ) {
    const instance = currentInstance
    applyTransitionLeaveHooksImpl(frag.nodes, transition, () => {
      // Unmounting cuts the leave short and runs afterLeave synchronously;
      // the pending branch must not be rendered into the torn-down tree.
      if (transition.state.isUnmounting) return
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
            undefined,
            pending.branchKey,
          )
        } else {
          frag.renderBranch(
            render,
            transition,
            parent,
            key,
            noScope,
            true,
            undefined,
            branchKey,
          )
        }
      } finally {
        restoreCurrentInstance(prevInstance)
      }
    })
    if (mode === 'out-in') {
      // out-in owns the removal here so update() can return before
      // rendering; the next branch mounts from the afterLeave callback.
      parent && remove(frag.nodes, parent)
      return true
    }
  }
  return false
}

// vdom identity of a transition child as the chain is walked: the first
// component or element is the child vnode, so its own key (or the default
// key of the branch it sits in) and its type are final and nothing below
// contributes; `type` is set once a component fixed the identity. Recorded
// per fragment so a branch re-render starting at that fragment resolves the
// same way as a walk from the Transition root.
export interface KeyContext {
  key: any
  type?: any
}
export const ROOT_KEY_CONTEXT: KeyContext = { key: undefined }
export const keyContexts: WeakMap<TransitionOwner, KeyContext> = new WeakMap()

export function transitionTypeOf(block: VaporComponentInstance): any {
  return (
    (isAsyncComponentEnabled && (block.type as any).__asyncResolved) ||
    block.type
  )
}

export function finalizeKeyContext(
  ctx: KeyContext,
  block: VaporComponentInstance,
): KeyContext {
  return ctx.type
    ? ctx
    : { key: block.$key ?? ctx.key, type: transitionTypeOf(block) }
}

export function withDefaultKey(ctx: KeyContext, key: any): KeyContext {
  return ctx.type || key == null ? ctx : { key }
}

function isUnresolvedAsyncWrapper(block: VaporComponentInstance): boolean {
  return (
    isAsyncComponentEnabled &&
    isAsyncWrapper(block) &&
    getAsyncWrapperInner(block) === undefined
  )
}

// The context a component hands to its content: fixed to the component's
// identity, except for an unresolved async wrapper, whose resolved child
// fixes it later with the wrapper key as default.
export function enterComponentKeyContext(
  ctx: KeyContext,
  block: VaporComponentInstance,
  unresolved: boolean = isUnresolvedAsyncWrapper(block),
): KeyContext {
  return unresolved
    ? withDefaultKey(ctx, block.$key)
    : finalizeKeyContext(ctx, block)
}

// Records the context a fragment's content resolves in and returns that
// content's context, `key` being the fragment's own default key.
export function enterFragmentKeyContext(
  frag: VaporFragment,
  ctx: KeyContext,
  key: any = getFragmentKey(frag),
): KeyContext {
  keyContexts.set(frag, ctx)
  return withDefaultKey(ctx, key)
}

function resolveChildIdentity(
  child: ResolvedTransitionBlock,
  ctx: KeyContext,
): void {
  transitionKeys.set(child, ctx.type ? ctx.key : (child.$key ?? ctx.key))
  if (ctx.type) setTransitionType(child, ctx.type)
}

/**
 * Resolve the transition child of `block` together with its identity.
 * `owner` is the fragment (or slot host) whose content `block` is.
 */
export function resolveTransitionBlock(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
  owner?: TransitionOwner,
): ResolvedTransitionBlock | undefined {
  let ctx = (owner && keyContexts.get(owner)) || ROOT_KEY_CONTEXT
  if (owner && isFragment(owner))
    ctx = withDefaultKey(ctx, getFragmentKey(owner))
  const children: ResolvedTransitionBlock[] = []
  collectTransitionBlocks(block, onFragment, children, ctx)
  return children[0]
}

/** Locate the transition child of `block` without touching its identity. */
export function findTransitionBlock(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
): ResolvedTransitionBlock | undefined {
  const children: ResolvedTransitionBlock[] = []
  collectTransitionBlocks(block, onFragment, children, undefined)
  return children[0]
}

// `ctx` undefined: locate only
function collectTransitionBlocks(
  block: Block,
  onFragment: ((frag: VaporFragment) => void) | undefined,
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
  onFragment: ((frag: VaporFragment) => void) | undefined,
  children: ResolvedTransitionBlock[],
  ctx: KeyContext | undefined,
): void {
  // vdom's getInnerChild: KeepAlive is looked through, its child is the one
  if (isKeepAliveEnabled && isKeepAlive(block)) {
    collectTransitionBlocks(block.block, onFragment, children, ctx)
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
        if (ctx) keyContexts.set(block.block, ctx)
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

function collectArrayTransitionBlocks(
  block: Block[],
  onFragment: ((frag: VaporFragment) => void) | undefined,
  children: ResolvedTransitionBlock[],
  ctx: KeyContext | undefined,
): void {
  let hasFound = false
  for (const c of block) {
    if (c instanceof Comment) continue
    if (__DEV__ && hasFound) {
      // warn more than one non-comment child
      warn(
        '<transition> can only be used on a single element or component. ' +
          'Use <transition-group> for lists.',
      )
      break
    }
    const nested: ResolvedTransitionBlock[] = []
    collectTransitionBlocks(c, onFragment, nested, ctx)
    if (nested.length) children.push(nested[0])
    hasFound = true
    if (!__DEV__) break
  }
}

function collectFragmentTransitionBlocks(
  block: VaporFragment,
  onFragment: ((frag: VaporFragment) => void) | undefined,
  children: ResolvedTransitionBlock[],
  ctx: KeyContext | undefined,
): void {
  if (isInteropEnabled && block.hasVDOMContent && block.hasVDOMContent()) {
    children.push(block)
    if (ctx) {
      resolveChildIdentity(block, ctx)
      if (!ctx.type) {
        const type = block.getTransitionType!()
        if (type !== undefined) setTransitionType(block, type)
      }
    }
    return
  }

  // collect fragments for setting transition hooks
  if (onFragment) onFragment(block)
  collectTransitionBlocks(
    block.nodes,
    onFragment,
    children,
    ctx && enterFragmentKeyContext(block, ctx),
  )
}

export function setTransitionHooks(
  block: TransitionBlock,
  hooks: VaporTransitionHooks,
): void {
  if (isVaporComponent(block)) {
    block = findTransitionBlock(block.block) as TransitionBlock
    if (!block) return
  }
  block.$transition = hooks
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
