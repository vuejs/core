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
  getComponentName,
  getTransitionRawChildren,
  isAsyncWrapper,
  isTemplateNode,
  leaveCbKey,
  onBeforeMount,
  queuePostFlushCb,
  resolveTransitionProps,
  useTransitionState,
  warn,
} from '@vue/runtime-dom'
import type {
  Block,
  TransitionBlock,
  TransitionOptions,
  VaporTransitionHooks,
} from '../block'
import { registerTransitionHooks } from '../transition'
import {
  type FunctionalVaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'
import {
  type DynamicFragment,
  ForFragment,
  type VaporFragment,
  isFragment,
} from '../fragment'
import {
  currentHydrationNode,
  isHydrating,
  setCurrentHydrationNode,
} from '../dom/hydration'
import { type PendingVShow, setCurrentPendingVShows } from '../directives/vShow'
import { isInteropEnabled } from '../vdomInteropState'

const displayName = 'VaporTransition'
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

    let resolvedProps: BaseTransitionProps<Element>
    renderEffect(() => (resolvedProps = resolveTransitionProps(props)))

    let pendingVShows: PendingVShow[] | undefined
    let children: Block
    if (!isHydrating && resolvedProps!.appear) {
      const prev = setCurrentPendingVShows((pendingVShows = []))
      try {
        children = (slots.default && slots.default()) as any as Block
      } finally {
        setCurrentPendingVShows(prev)
      }
    } else {
      children = (slots.default && slots.default()) as any as Block
    }
    if (!children) return []

    const instance = currentInstance! as VaporComponentInstance
    const { mode } = props
    checkTransitionMode(mode)

    const { hooks, root } = applyResolvedTransitionHooks(children, {
      state,
      // use proxy to keep props reference stable
      props: new Proxy({} as BaseTransitionProps<Element>, {
        get(_, key) {
          return resolvedProps[key as keyof BaseTransitionProps<Element>]
        },
      }),
      instance: instance,
    } as VaporTransitionHooks)

    if (pendingVShows) {
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
        // Flush the deferred initial v-show writes right before mount so the
        // DOM is still not inserted, but transition hooks are already ready.
        for (const pending of pendingVShows) {
          pending.setDisplay()
        }
        pendingVShows.length = 0
      })
    }

    if (resolvedProps!.appear && performAppear) {
      performAppear(hooks)
    }

    return children
  })

const transitionTypeMap = new WeakMap<ResolvedTransitionBlock, any>()

function getTransitionType(block: ResolvedTransitionBlock): any {
  const type = transitionTypeMap.get(block)
  if (type !== undefined) return type
  if (block instanceof Element) return block.localName
  if (isFragment(block) && block.vnode) {
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
  if (block instanceof Element) {
    return block as TransitionElement
  }
  if (isInteropEnabled && isFragment(block) && block.vnode) {
    const el = getTransitionElementFromVNode(block.vnode)
    if (el) return el as TransitionElement
  }
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

  // delegate to TransitionGroup's apply logic for list children
  if (hooks.applyGroup && block instanceof ForFragment) {
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

export function resolveTransitionBlock(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
): ResolvedTransitionBlock | undefined {
  let child: ResolvedTransitionBlock | undefined
  if (block instanceof Node) {
    // transition can only be applied on Element child
    if (block instanceof Element) child = block
  } else if (isVaporComponent(block)) {
    if (isAsyncWrapper(block)) {
      // for unresolved async wrapper, set transition hooks on inner fragment
      if (!block.type.__asyncResolved) {
        onFragment && onFragment(block.block! as DynamicFragment)
      } else {
        child = resolveTransitionBlock(
          (block.block! as DynamicFragment).nodes,
          onFragment,
        )
        if (child) {
          if (child.$key == null) {
            child.$key = block.$key ?? block.uid
          }
          // align with normal component branches so leaving cache can
          // distinguish different resolved async wrapper types.
          transitionTypeMap.set(child, block.type)
        }
      }
    } else {
      // stop searching if encountering nested Transition component
      if (getComponentName(block.type) === displayName) return undefined
      child = resolveTransitionBlock(block.block, onFragment)
      if (child) {
        if (child.$key == null) {
          // prefer explicit component key, otherwise fall back to uid.
          child.$key = block.$key ?? block.uid
        }
        transitionTypeMap.set(child, block.type)
      }
    }
  } else if (isArray(block)) {
    let hasFound = false
    for (const c of block) {
      if (c instanceof Comment) continue
      const item = resolveTransitionBlock(c, onFragment)
      if (__DEV__ && hasFound) {
        // warn more than one non-comment child
        warn(
          '<transition> can only be used on a single element or component. ' +
            'Use <transition-group> for lists.',
        )
        break
      }
      child = item
      hasFound = true
      if (!__DEV__) break
    }
  } else if (isFragment(block)) {
    if (isInteropEnabled && block.vnode) {
      child = block
      const children = getTransitionRawChildren([block.vnode])
      if (children.length === 1) {
        transitionTypeMap.set(child, children[0].type)
      }
    } else {
      // collect fragments for setting transition hooks
      if (onFragment) onFragment(block)
      child = resolveTransitionBlock(block.nodes, onFragment)
    }
  }

  return child
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

export function getTransitionElementFromVNode(
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
