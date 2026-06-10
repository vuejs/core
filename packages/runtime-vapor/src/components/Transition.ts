import {
  type BaseTransitionProps,
  type GenericComponentInstance,
  type TransitionElement,
  type TransitionHooks,
  type TransitionHooksContext,
  type TransitionProps,
  TransitionPropsValidators,
  type TransitionState,
  type VNode,
  baseResolveTransitionHooks,
  checkTransitionMode,
  currentInstance,
  getTransitionRawChildren,
  isAsyncWrapper,
  isTemplateNode,
  leaveCbKey,
  onBeforeMount,
  queuePostFlushCb,
  resolveTransitionProps,
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
  isValidBlock,
  remove,
} from '../block'
import { displayName, registerTransitionHooks } from '../transition'
import {
  type FunctionalVaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'
import {
  DynamicFragment,
  ForBlock,
  ForFragment,
  type VaporFragment,
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

type ResolveTransitionBlocksOptions = {
  mode: 'single' | 'group'
  onFragment?: (frag: VaporFragment) => void
  onUpdateOwner?: (owner: VaporFragment | VaporComponentInstance) => void
}

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
        applyPendingVShows(
          frag.$transition!,
          resolveTransitionBlock(frag.nodes),
          pendingVShows,
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

    const { hooks, root } = applyResolvedTransitionHooks(children, {
      state,
      // use proxy to keep props reference stable
      props: propsProxy,
      instance: instance,
    } as VaporTransitionHooks)
    applyPendingVShows(hooks, root, pendingVShows)
    if (shouldPerformAppear) performAppear(hooks)
    return children
  })

const transitionTypeMap = new WeakMap<ResolvedTransitionBlock, any>()
const inheritedTransitionKeyMap = new WeakMap<
  ResolvedTransitionBlock,
  InheritedTransitionKeyRecord
>()

type InheritedTransitionKeyRecord = {
  generation: number
  rawBaseKey: any
  inheritedKey: string
}

let transitionKeyGeneration = 0
let currentTransitionKeyGeneration = 0

function getTransitionType(block: ResolvedTransitionBlock): any {
  const type = transitionTypeMap.get(block)
  if (type !== undefined) return type
  if (block instanceof Element) return block.localName
  if (isInteropEnabled && isFragment(block) && block.vnode) {
    const children = getTransitionRawChildren([block.vnode])
    if (children.length === 1) return children[0].type
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
      const el = leavingNode && getLeaveElement(leavingNode)
      if (el && el[leaveCbKey]) {
        // force early removal (not cancelled)
        el[leaveCbKey]!()
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

function applyTransitionHooksImpl(
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
} {
  // filter out comment nodes
  if (isArray(block)) {
    block = block.filter(b => !(b instanceof Comment))
    if (block.length === 1) {
      block = block[0]
    } else if (block.length === 0) {
      return { hooks }
    }
  }

  // Delegate list/root-slot wrappers back to TransitionGroup's apply logic.
  // Other fragment shapes, such as keyed v-if branches, still need normal
  // enter/leave hooks for their resolved single child.
  if (
    hooks.applyGroup &&
    (block instanceof ForFragment ||
      isSlotFragment(block) ||
      (isVaporComponent(block) && isSlotFragment(block.block)))
  ) {
    hooks.applyGroup(block, hooks.props, hooks.state, hooks.instance)
    return { hooks }
  }

  const fragments: VaporFragment[] = []
  const child = resolveTransitionBlock(block, frag => fragments.push(frag))
  if (!child) {
    // set transition hooks on fragments for later use
    fragments.forEach(f => (f.$transition = hooks))
    // warn if no child and no fragments
    if (__DEV__ && fragments.length === 0) {
      warn('Transition component has no valid child element')
    }
    return { hooks }
  }

  const { props, instance, state, delayedLeave } = hooks
  let resolvedHooks = resolveTransitionHooks(
    child,
    props,
    state,
    instance,
    hooks => (resolvedHooks = hooks as VaporTransitionHooks),
  )
  // Dynamic slot updates replace the active hook object. Preserve any
  // runtime-derived persisted state for slot/component-root v-show.
  resolvedHooks.persisted = resolvedHooks.persisted || hooks.persisted
  resolvedHooks.delayedLeave = delayedLeave
  child.$transition = resolvedHooks
  fragments.forEach(f => (f.$transition = resolvedHooks))

  return {
    hooks: resolvedHooks,
    root: child,
  }
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
    (mode !== 'in-out' || (mode === 'in-out' && render)) &&
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
  return resolveTransitionChildren(block, { mode: 'single', onFragment })[0]
}

export function resolveTransitionBlocks(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
  onUpdateOwner?: (owner: VaporFragment | VaporComponentInstance) => void,
): ResolvedTransitionBlock[] {
  return resolveTransitionChildren(block, {
    mode: 'group',
    onFragment,
    onUpdateOwner,
  })
}

function resolveTransitionChildren(
  block: Block,
  options: ResolveTransitionBlocksOptions,
): ResolvedTransitionBlock[] {
  const children: ResolvedTransitionBlock[] = []
  const prevGeneration = currentTransitionKeyGeneration
  currentTransitionKeyGeneration = ++transitionKeyGeneration
  try {
    collectTransitionBlocks(block, options, children)
    return children
  } finally {
    currentTransitionKeyGeneration = prevGeneration
  }
}

function collectTransitionBlocks(
  block: Block,
  options: ResolveTransitionBlocksOptions,
  children: ResolvedTransitionBlock[],
): void {
  if (block instanceof Node) {
    // transition can only be applied on Element child
    if (block instanceof Element) children.push(block)
  } else if (isVaporComponent(block)) {
    collectComponentTransitionBlocks(block, options, children)
  } else if (isArray(block)) {
    collectArrayTransitionBlocks(block, options, children)
  } else if (isFragment(block)) {
    collectFragmentTransitionBlocks(block, options, children)
  }
}

function collectComponentTransitionBlocks(
  block: VaporComponentInstance,
  options: ResolveTransitionBlocksOptions,
  children: ResolvedTransitionBlock[],
): void {
  if (options.mode === 'group') {
    // A normal component child can move when parent-driven props update its
    // root layout without re-running the surrounding v-for fragment.
    // When the component root is a slot, the TransitionGroup children are the
    // slotted blocks, so track the slot fragment instead of the component.
    const isRootSlot = block.block && isSlotFragment(block.block)
    if (options.onUpdateOwner && !isRootSlot) options.onUpdateOwner(block)

    const start = children.length
    collectTransitionBlocks(
      block.block,
      isRootSlot
        ? options
        : {
            mode: options.mode,
            onFragment: options.onFragment,
          },
      children,
    )
    inheritTransitionKey(children, start, block.$key)
    return
  }

  if (isAsyncWrapper(block)) {
    // for unresolved async wrapper, set transition hooks on inner fragment
    if (!block.type.__asyncResolved) {
      if (options.onFragment)
        options.onFragment(block.block! as DynamicFragment)
      return
    }

    const start = children.length
    collectTransitionBlocks(
      (block.block! as DynamicFragment).nodes,
      options,
      children,
    )
    inheritSingleComponentKey(children[start], block)
    return
  }

  // stop searching if encountering nested Transition component
  if (block.type === VaporTransition) return

  const start = children.length
  collectTransitionBlocks(block.block, options, children)
  inheritSingleComponentKey(children[start], block)
}

function collectArrayTransitionBlocks(
  block: Block[],
  options: ResolveTransitionBlocksOptions,
  children: ResolvedTransitionBlock[],
): void {
  if (options.mode === 'group') {
    for (const c of block) {
      const start = children.length
      collectTransitionBlocks(c, options, children)
      if (c instanceof ForBlock) {
        const count = children.length - start
        for (let j = start; j < children.length; j++) {
          children[j].$key =
            c.key != null && count > 1 ? `${c.key}:${j - start}` : c.key
        }
      }
    }
    return
  }

  let hasFound = false
  for (const c of block) {
    if (c instanceof Comment) continue
    const nested: ResolvedTransitionBlock[] = []
    collectTransitionBlocks(c, options, nested)
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
  options: ResolveTransitionBlocksOptions,
  children: ResolvedTransitionBlock[],
): void {
  if (options.mode === 'group') {
    if (options.onFragment) options.onFragment(block)
    if (options.onUpdateOwner) options.onUpdateOwner(block)
    if (isInteropEnabled && block.vnode) {
      // vdom component
      children.push(block)
    } else {
      const start = children.length
      collectTransitionBlocks(block.nodes, options, children)
      inheritTransitionKey(children, start, block.$key)
    }
    return
  }

  if (isInteropEnabled && block.vnode) {
    children.push(block)
    const rawChildren = getTransitionRawChildren([block.vnode])
    if (rawChildren.length === 1) {
      transitionTypeMap.set(block, rawChildren[0].type)
    }
    return
  }

  // collect fragments for setting transition hooks
  if (options.onFragment) options.onFragment(block)
  collectTransitionBlocks(block.nodes, options, children)
}

function inheritSingleComponentKey(
  child: ResolvedTransitionBlock | undefined,
  block: VaporComponentInstance,
): void {
  if (!child) return
  if (child.$key == null) {
    // prefer explicit component key, otherwise fall back to uid.
    child.$key = block.$key ?? block.uid
  }
  transitionTypeMap.set(child, block.type)
}

function inheritTransitionKey(
  children: ResolvedTransitionBlock[],
  start: number,
  key: any,
): void {
  if (key == null || start === children.length) return
  for (let i = start; i < children.length; i++) {
    const child = children[i]
    let record = inheritedTransitionKeyMap.get(child)
    let baseKey
    // Match VDOM parentKey + (child.key ?? index) composition, while reusing
    // the raw base key across resolutions to avoid repeating prefixes.
    if (record && record.generation === currentTransitionKeyGeneration) {
      baseKey = child.$key != null ? child.$key : i - start
    } else {
      if (!record || !Object.is(child.$key, record.inheritedKey)) {
        record = {
          generation: currentTransitionKeyGeneration,
          rawBaseKey: child.$key != null ? child.$key : i - start,
          inheritedKey: '',
        }
        inheritedTransitionKeyMap.set(child, record)
      } else {
        record.generation = currentTransitionKeyGeneration
      }
      baseKey = record.rawBaseKey
    }
    record.inheritedKey = String(key) + String(baseKey)
    child.$key = record.inheritedKey
  }
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

export function getVNodeKey(
  vnode: VNode | undefined,
): VNode['key'] | undefined {
  if (!vnode) return
  const children = getTransitionRawChildren([vnode])
  return children.length === 1 ? children[0].key : undefined
}

function getTransitionElementFromVNode(
  vnode: VNode | undefined,
): Element | undefined {
  if (!vnode) return
  if (vnode.component) {
    return getTransitionElementFromVNode(vnode.component.subTree)
  }
  if (vnode.el instanceof Element) {
    return vnode.el
  }
  const children = getTransitionRawChildren([vnode])
  if (children.length === 1 && children[0] !== vnode) {
    return getTransitionElementFromVNode(children[0])
  }
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
    return getTransitionElementFromVNode(block.vnode)
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
): void {
  if (!pendingVShows) return

  if (root) {
    // Keep compiler-injected persisted for direct v-show children, and
    // additionally treat slot/component roots as persisted when their
    // deferred v-show target resolves to the same transition root.
    hooks.persisted =
      hooks.persisted ||
      pendingVShows.some(
        pending =>
          pending.target === root ||
          resolveTransitionBlock(pending.target) === root,
      )
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
