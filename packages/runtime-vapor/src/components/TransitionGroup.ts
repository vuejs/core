import {
  type BaseTransitionProps,
  type ElementWithTransition,
  type TransitionGroupProps,
  type TransitionProps,
  TransitionPropsValidators,
  type TransitionState,
  type VShowElement,
  baseApplyTranslation,
  callPendingCbs,
  currentInstance,
  forceReflow,
  handleMovedChildren,
  hasCSSTransform,
  onBeforeUpdate,
  onUpdated,
  queuePostRenderEffect,
  resolveTransitionProps,
  restoreCurrentInstance,
  setCurrentInstance,
  useTransitionState,
  vShowHidden,
  warn,
} from '@vue/runtime-dom'
import { extend, isArray, isFunction } from '@vue/shared'
import {
  type Block,
  type BlockFn,
  type TransitionBlock,
  insert,
  registerNestedVDOMCleanup,
} from '../block'
import { renderEffect } from '../renderEffect'
import {
  type KeyContext,
  ROOT_KEY_CONTEXT,
  type ResolvedTransitionBlock,
  applyTransitionHooksImpl,
  enterComponentKeyContext,
  enterFragmentKeyContext,
  getTransitionElement,
  getTransitionKey,
  isValidTransitionBlock,
  resolveTransitionHooks,
  setTransitionKey,
  setTransitionType,
  transitionTypeOf,
  withDefaultKey,
} from './Transition'
import {
  type VaporComponentInstance,
  type VaporComponentOptions,
  isVaporComponent,
} from '../component'
import { type RawProps, resolveDynamicProps } from '../componentProps'
import { createElement } from '../dom/node'
import {
  DynamicFragment,
  type VaporFragment,
  getFragmentKey,
  isForBlock,
  isFragment,
  isVaporSlotOutlet,
} from '../fragment'
import {
  type DefineVaporComponent,
  defineVaporComponent,
} from '../apiDefineComponent'
import {
  adoptTemplate,
  advanceHydrationNode,
  claimAnchor,
  cleanupHydrationTail,
  createFragmentClaim,
  currentHydrationNode,
  isHydrating,
  locateEndAnchor,
  locateHydrationNode,
  nextLogicalSibling,
  setCurrentHydrationNode,
  trimHydrationBoundary,
} from '../dom/hydration'
import { isTransitionEnabled, registerTransitionHooks } from '../transition'
import { isInteropEnabled } from '../vdomInteropState'

const positionMap = new WeakMap<TransitionBlock, DOMRect>()
const newPositionMap = new WeakMap<TransitionBlock, DOMRect>()

type TransitionGroupUpdateOwner = VaporFragment | VaporComponentInstance

type TransitionGroupUpdateHooks = {
  beforeUpdate: () => void
  updated: () => void
}

// owners whose updates already report to their TransitionGroup
const trackedTransitionGroupOwners = new WeakSet<TransitionGroupUpdateOwner>()

const decorate = <T extends VaporComponentOptions>(t: T): T => {
  delete (t.props! as any).mode
  return t
}

const VaporTransitionGroupImpl = /*@__PURE__*/ defineVaporComponent({
  name: 'VaporTransitionGroup',

  props: /*@__PURE__*/ extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String,
  }),

  setup(props: TransitionGroupProps, { slots, expose }) {
    // @ts-expect-error
    expose()

    if (!isTransitionEnabled) {
      registerTransitionHooks(
        applyTransitionHooksImpl,
        () => false,
        () => false,
        () => false,
      )
    }

    const instance = currentInstance as VaporComponentInstance
    const state = useTransitionState()

    // use proxy to keep props reference stable
    let cssTransitionProps!: BaseTransitionProps<Element>
    const propsProxy = new Proxy({} as BaseTransitionProps<Element>, {
      get(_, key) {
        return cssTransitionProps[key as keyof BaseTransitionProps<Element>]
      },
    })

    let prevChildren: ResolvedTransitionBlock[] = []
    // Multiple child owners can update in the same flush (e.g. a VDOM child
    // props update plus the surrounding v-for keyed diff). Keep the first old
    // position snapshot, then apply moves after child render jobs have flushed.
    let isUpdatePending = false
    let isUpdatedPending = false
    let slottedBlock: Block = []

    const beforeUpdate = () => {
      if (isUpdatePending) return
      isUpdatePending = true
      prevChildren = []
      // collect-only: the snapshot loop below reads elements and existing
      // hooks; skip owner tracking and key-inheritance bookkeeping.
      const children = resolveTransitionBlocks(
        slottedBlock,
        undefined,
        undefined,
        true,
      )
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const el =
          isValidTransitionBlock(child) && child.$transition
            ? getTransitionElement(child)
            : undefined
        if (
          el &&
          // Hidden v-show nodes have no previous layout box to animate from.
          !(el as VShowElement)[vShowHidden]
        ) {
          prevChildren.push(child)
          positionMap.set(child, el.getBoundingClientRect())
        }
      }
    }

    const flushUpdated = () => {
      isUpdatedPending = false
      if (!isUpdatePending) return
      isUpdatePending = false
      if (!prevChildren.length) return

      const moveClass = props.moveClass || `${props.name || 'v'}-move`
      const firstChild = getFirstConnectedChild(prevChildren)
      const hasMove = !!(
        firstChild &&
        hasCSSTransform(
          firstChild as ElementWithTransition,
          firstChild.parentNode as Node,
          moveClass,
        )
      )
      if (!hasMove) {
        prevChildren = []
        return
      }

      prevChildren.forEach(child => {
        // pending enter/move cbs live on the element, which for interop
        // children is not the block itself
        const el = getTransitionElement(child)
        if (el) callPendingCbs(el)
      })

      prevChildren.forEach(recordPosition)
      const movedChildren = prevChildren.filter(applyTranslation)

      // force reflow to put everything in position; use the group's own
      // document so this works inside iframes / foreign documents
      forceReflow(firstChild)

      movedChildren.forEach(c =>
        handleMovedChildren(
          getTransitionElement(c) as ElementWithTransition,
          moveClass,
        ),
      )
      prevChildren = []
    }

    const updated = () => {
      if (!isUpdatePending || isUpdatedPending) return
      isUpdatedPending = true
      queuePostRenderEffect(flushUpdated, undefined, instance.suspense)
    }

    onBeforeUpdate(beforeUpdate)
    onUpdated(updated)
    const updateHooks: TransitionGroupUpdateHooks = { beforeUpdate, updated }

    // The wrapper element is static configuration, not animated content:
    // `tag` is read once. (vdom only remounts the children on a tag change
    // because the parent re-render patches the root vnode type.)
    const tag = props.tag
    // without a tag the server wraps the group in a range of its own
    let close: Node | null = null
    if (isHydrating) {
      const claim = tag ? undefined : createFragmentClaim()
      locateHydrationNode(claim)
      if (claim && claim.start) {
        close = claimAnchor(locateEndAnchor(claim.start)!)
      }
    }
    let isMounted = false

    renderEffect(() => {
      cssTransitionProps = resolveTransitionProps(props)
      // The shared baseResolveTransitionHooks destructures props eagerly, so
      // hooks already applied to mounted children capture stale values when
      // reactive transition props change. Mirror Transition's re-resolve by
      // re-applying group hooks onto the current children. Children mid-leave
      // are no longer collected and keep the hooks their leave started with.
      if (isMounted) {
        applyGroupTransitionHooks(
          slottedBlock,
          propsProxy,
          state,
          instance,
          updateHooks,
        )
      }
    }, true)

    const createContainer = (): HTMLElement | undefined =>
      tag
        ? isHydrating
          ? (adoptTemplate(currentHydrationNode!, `<${tag}/>`) as HTMLElement)
          : createElement(tag)
        : undefined

    const renderChildren = (
      slot: BlockFn | undefined,
      container: HTMLElement | undefined,
      // the dynamic slot path renders through its fragment
      run: (render: BlockFn) => void = render => render(),
    ): void => {
      let nextNode: Node | null = null
      if (isHydrating && container) {
        // the cursor sits on the container itself when it is empty
        nextNode = nextLogicalSibling(container)
        setCurrentHydrationNode(container.firstChild || container)
      }
      try {
        run(() => {
          const block = (slot && slot()) || []
          applyGroupTransitionHooks(
            block,
            propsProxy,
            state,
            instance,
            updateHooks,
          )
          slottedBlock = block
          if (container) {
            if (!isHydrating) insert(block, container)
            registerNestedVDOMCleanup(block)
            return container
          }
          return block
        })
        if (
          isHydrating &&
          container &&
          currentHydrationNode &&
          currentHydrationNode.parentNode === container
        ) {
          // Remove extra SSR nodes left after hydrating the current children.
          cleanupHydrationTail(currentHydrationNode, container)
        }
        if (isHydrating && close) {
          trimHydrationBoundary(close)
          if (currentHydrationNode === close) advanceHydrationNode(close)
          close = null
        }
      } finally {
        if (isHydrating && container) {
          setCurrentHydrationNode(nextNode)
        }
      }
      isMounted = true
    }

    if (!instance.rawSlots.$) {
      const container = createContainer()
      renderChildren(slots.default, container)
      return container || slottedBlock
    }

    // Dynamic slot sources can add/remove the default slot after setup, so
    // the group re-renders it through a DynamicFragment (as Transition does).
    const frag = new DynamicFragment(
      0,
      __DEV__ ? 'transition-group' : undefined,
    )
    let currentSlot: BlockFn | undefined
    renderEffect(() => {
      const slot = slots.default
      if (isMounted && slot === currentSlot) return
      renderChildren(slot, createContainer(), render => frag.update(render))
      currentSlot = slot
    })
    return frag
  },
})

export const VaporTransitionGroup: DefineVaporComponent<
  {},
  string,
  TransitionGroupProps
> = /*@__PURE__*/ decorate(VaporTransitionGroupImpl)

// Composed keys of the current resolution pass. Owners compose bottom-up, so
// a child under nested keyed owners reads its inner composition here first.
type ComposedKeys = Map<ResolvedTransitionBlock, any>

export function resolveTransitionBlocks(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
  onUpdateOwner?: (owner: TransitionGroupUpdateOwner) => void,
  // collect elements only, skipping key/type inheritance side effects
  collectOnly = false,
): ResolvedTransitionBlock[] {
  const children: ResolvedTransitionBlock[] = []
  if (collectOnly) {
    collectTransitionBlocks(block, children, onFragment, onUpdateOwner)
    return children
  }
  const keys: ComposedKeys = new Map()
  collectTransitionBlocks(
    block,
    children,
    onFragment,
    onUpdateOwner,
    keys,
    ROOT_KEY_CONTEXT,
  )
  for (let i = 0; i < children.length; i++) {
    setTransitionKey(children[i], keys.get(children[i]))
  }
  return children
}

// `ctx` only records the per-fragment key context for branch re-renders
// (applyTransitionHooksImpl's single-child path); list keys are composed
// bottom-up below. Both are skipped by the collect-only pass.
function collectTransitionBlocks(
  block: Block,
  children: ResolvedTransitionBlock[],
  onFragment?: (frag: VaporFragment) => void,
  onUpdateOwner?: (owner: TransitionGroupUpdateOwner) => void,
  keys?: ComposedKeys,
  ctx?: KeyContext,
): void {
  if (block instanceof Node) {
    if (block instanceof Element) {
      children.push(block)
      if (keys) keys.set(block, (block as ResolvedTransitionBlock).$key)
    }
  } else if (isVaporComponent(block)) {
    const isRootSlot = block.block && isVaporSlotOutlet(block.block)
    if (onUpdateOwner && !isRootSlot) onUpdateOwner(block)

    const start = children.length
    collectTransitionBlocks(
      block.block,
      children,
      onFragment,
      isRootSlot ? onUpdateOwner : undefined,
      keys,
      ctx &&
        (isRootSlot
          ? withDefaultKey(ctx, block.$key)
          : enterComponentKeyContext(ctx, block)),
    )
    if (keys) {
      if (!isRootSlot) {
        const t = transitionTypeOf(block)
        for (let i = start; i < children.length; i++) {
          setTransitionType(children[i], t)
        }
      }
      // a root-slot component is transparent, like the slot outlet it wraps
      resolveOwnerKey(children, start, block.$key, keys, !isRootSlot)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      collectTransitionBlocks(
        block[i],
        children,
        onFragment,
        onUpdateOwner,
        keys,
        ctx,
      )
    }
  } else if (isFragment(block)) {
    // ForBlock wrappers have no transition consumers of their own: they
    // override neither insert nor remove (the only readers of fragment
    // $transition) and their update hook arrays are never invoked. Skip the
    // per-item hook/owner bookkeeping and only collect their contents.
    const isItem = isForBlock(block)
    if (!isItem) {
      if (onFragment) onFragment(block)
      if (onUpdateOwner) onUpdateOwner(block)
    }
    if (isInteropEnabled && block.hasVDOMContent && block.hasVDOMContent()) {
      children.push(block)
      if (keys) keys.set(block, block.$key)
    } else {
      const key = isItem ? block.key : getFragmentKey(block)
      const start = children.length
      collectTransitionBlocks(
        block.nodes,
        children,
        onFragment,
        onUpdateOwner,
        keys,
        ctx && enterFragmentKeyContext(block, ctx, key),
      )
      if (!keys) return
      if (!isItem) {
        resolveOwnerKey(children, start, key, keys, false)
      } else if (key != null) {
        // an unkeyed row composes nothing: its roots keep their own keys
        if (children.length - start === 1) {
          // the row key is the single root's own key
          keys.set(children[start], key)
        } else {
          for (let i = start; i < children.length; i++) {
            keys.set(children[i], `${key}:${i - start}`)
          }
        }
      }
    }
  }
}

// vdom key semantics for the block owning the collected roots: a component
// is the child vnode, so its key is final for a single root; a fragment only
// supplies the default key of its single root. Multiple roots compose the
// owner key with each root's key, as vdom does for fragment children.
function resolveOwnerKey(
  children: ResolvedTransitionBlock[],
  start: number,
  key: any,
  keys: ComposedKeys,
  final: boolean,
): void {
  if (children.length - start === 1) {
    const child = children[start]
    if (final || keys.get(child) == null) keys.set(child, key)
    return
  }
  if (key == null) return
  for (let i = start; i < children.length; i++) {
    const child = children[i]
    const inner = keys.get(child)
    keys.set(child, String(key) + String(inner != null ? inner : i - start))
  }
}

function applyGroupTransitionHooks(
  block: Block,
  props: TransitionProps,
  state: TransitionState,
  instance: VaporComponentInstance,
  updateHooks: TransitionGroupUpdateHooks,
): ResolvedTransitionBlock[] {
  const fragments: VaporFragment[] = []
  const children = resolveTransitionBlocks(
    block,
    frag => fragments.push(frag),
    owner => trackTransitionGroupUpdate(owner, instance, updateHooks),
  )
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isValidTransitionBlock(child)) {
      if (getTransitionKey(child) != null) {
        child.$transition = resolveTransitionHooks(
          child,
          props,
          state,
          instance,
        )
      } else if (__DEV__) {
        warn(`<transition-group> children must be keyed`)
      }
    }
  }

  // propagate hooks to inner fragments for reusing during insert new items
  fragments.forEach(frag => {
    const hooks = resolveTransitionHooks(frag, props, state, instance)
    hooks.applyGroup = (block, props, state, instance) =>
      applyGroupTransitionHooks(block, props, state, instance, updateHooks)
    frag.$transition = hooks
  })
  return children
}

function trackTransitionGroupUpdate(
  owner: TransitionGroupUpdateOwner,
  instance: VaporComponentInstance,
  updateHooks: TransitionGroupUpdateHooks,
): void {
  if (trackedTransitionGroupOwners.has(owner)) return

  if (isFragment(owner)) {
    trackedTransitionGroupOwners.add(owner)
    ;(owner.bu ||= []).push(updateHooks.beforeUpdate)
    ;(owner.u ||= []).push(updateHooks.updated)
    return
  }

  // Fully static raw props can never notify - skip the tracking effect.
  if (!hasDynamicPropsSource(owner.rawProps)) return
  trackedTransitionGroupOwners.add(owner)

  // A component child can update from parent-driven props without re-running
  // the surrounding v-for fragment. Track raw props directly instead of
  // using component updated hooks, because child-local state updates should
  // not trigger TransitionGroup move bookkeeping. This matches VDOM behavior.
  // The effect belongs to the group instance, so its runs report through the
  // group's own beforeUpdate/updated hooks and the scheduler orders it ahead
  // of the child's effects; it lives in the child's scope to die with the row.
  const prevGroup = setCurrentInstance(instance, owner.scope)
  try {
    renderEffect(() => {
      // dynamic prop sources resolve as child props: run the getters as the
      // child instance
      const prev = setCurrentInstance(owner, owner.scope)
      try {
        resolveDynamicProps(owner.rawProps)
      } finally {
        restoreCurrentInstance(prev)
      }
    })
  } finally {
    restoreCurrentInstance(prevGroup)
  }
}

function hasDynamicPropsSource(props: RawProps): boolean {
  if (props.$) return true
  for (const key in props) {
    if (key !== '$' && isFunction(props[key])) return true
  }
  return false
}

function recordPosition(c: ResolvedTransitionBlock) {
  const el = getTransitionElement(c)
  if (el) newPositionMap.set(c, el.getBoundingClientRect())
}

function applyTranslation(
  c: ResolvedTransitionBlock,
): ResolvedTransitionBlock | undefined {
  const el = getTransitionElement(c)
  if (
    el &&
    baseApplyTranslation(
      positionMap.get(c)!,
      newPositionMap.get(c)!,
      el as ElementWithTransition,
    )
  ) {
    return c
  }
}

function getFirstConnectedChild(
  children: ResolvedTransitionBlock[],
): Element | undefined {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const el = getTransitionElement(child)
    if (el && el.isConnected) return el
  }
}
