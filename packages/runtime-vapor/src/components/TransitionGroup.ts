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
} from '../block'
import { renderEffect } from '../renderEffect'
import {
  type ResolvedTransitionBlock,
  applyTransitionHooksImpl,
  getTransitionElement,
  getTransitionKey,
  groupTransitionKeys,
  isValidTransitionBlock,
  resolveTransitionHooks,
  setTransitionType,
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
  isForBlock,
  isFragment,
  isSlotFragment,
} from '../fragment'
import {
  type DefineVaporComponent,
  defineVaporComponent,
} from '../apiDefineComponent'
import {
  adoptTemplate,
  cleanupHydrationTail,
  currentHydrationNode,
  isHydrating,
  nextLogicalSibling,
  setCurrentHydrationNode,
  setMarkerlessHydrationContainer,
  setTransitionChildPending,
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

    const frag = new DynamicFragment(
      0,
      __DEV__ ? 'transition-group' : undefined,
    )
    let currentTag: string | undefined
    let currentSlot: BlockFn | undefined
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

    renderEffect(() => {
      const tag = props.tag
      const slot = slots.default
      // if the tag and slot are the same as previous render, no need to update.
      if (isMounted && tag === currentTag && slot === currentSlot) return

      const container = tag
        ? isHydrating
          ? (adoptTemplate(currentHydrationNode!, `<${tag}/>`) as HTMLElement)
          : createElement(tag)
        : undefined
      let nextNode: Node | null = null
      let prevMarkerlessContainer: ParentNode | null = null
      let prevTransitionChildPending = false
      if (isHydrating && container) {
        // SSR flattens the children into the container without fragment
        // markers; the cursor sits on the container itself when it is empty.
        prevMarkerlessContainer = setMarkerlessHydrationContainer(container)
        prevTransitionChildPending = setTransitionChildPending(true)
        nextNode = nextLogicalSibling(container)
        setCurrentHydrationNode(container.firstChild || container)
      }
      let block: Block = slottedBlock
      let transitionBlocks: ResolvedTransitionBlock[] = []
      try {
        frag.update(() => {
          block = (slot && slot()) || []
          transitionBlocks = applyGroupTransitionHooks(
            block,
            propsProxy,
            state,
            instance,
            updateHooks,
          )
          if (container) {
            if (!isHydrating) insert(block, container)
            return container
          }
          return block
        })
        if (
          isHydrating &&
          container &&
          currentHydrationNode &&
          currentHydrationNode.parentNode === container &&
          !transitionBlocks.some(child => child === currentHydrationNode)
        ) {
          // Remove extra SSR nodes left after hydrating the current children,
          // but keep a node that was claimed as a transition child.
          cleanupHydrationTail(currentHydrationNode, container)
        }
      } finally {
        if (isHydrating && container) {
          setMarkerlessHydrationContainer(prevMarkerlessContainer)
          setTransitionChildPending(prevTransitionChildPending)
          setCurrentHydrationNode(nextNode)
        }
      }
      slottedBlock = block

      currentTag = tag
      currentSlot = slot
      isMounted = true
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
  const composed: ComposedKeys = new Map()
  collectTransitionBlocks(block, children, onFragment, onUpdateOwner, composed)
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const key = composed.get(child)
    if (key !== undefined) {
      groupTransitionKeys.set(child, key)
    } else {
      groupTransitionKeys.delete(child)
    }
  }
  return children
}

function collectTransitionBlocks(
  block: Block,
  children: ResolvedTransitionBlock[],
  onFragment?: (frag: VaporFragment) => void,
  onUpdateOwner?: (owner: TransitionGroupUpdateOwner) => void,
  composed?: ComposedKeys,
): void {
  if (block instanceof Node) {
    if (block instanceof Element) children.push(block)
  } else if (isVaporComponent(block)) {
    const isRootSlot = block.block && isSlotFragment(block.block)
    if (onUpdateOwner && !isRootSlot) onUpdateOwner(block)

    const start = children.length
    collectTransitionBlocks(
      block.block,
      children,
      onFragment,
      isRootSlot ? onUpdateOwner : undefined,
      composed,
    )
    if (composed) {
      if (!isRootSlot) {
        for (let i = start; i < children.length; i++) {
          setTransitionType(children[i], block.type)
        }
      }
      inheritTransitionKey(children, start, block.$key, composed)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      collectTransitionBlocks(
        block[i],
        children,
        onFragment,
        onUpdateOwner,
        composed,
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
    } else {
      const start = children.length
      collectTransitionBlocks(
        block.nodes,
        children,
        onFragment,
        onUpdateOwner,
        composed,
      )
      if (!composed) {
        // element collection only; keys were resolved by the apply pass
      } else if (isItem) {
        const count = children.length - start
        if (count === 1) {
          // the row key is the single root's own key
          children[start].$key = block.key
        } else if (block.key != null) {
          for (let i = start; i < children.length; i++) {
            composed.set(children[i], `${block.key}:${i - start}`)
          }
        }
      } else {
        inheritTransitionKey(children, start, block.$key, composed)
      }
    }
  }
}

function inheritTransitionKey(
  children: ResolvedTransitionBlock[],
  start: number,
  key: any,
  composed: ComposedKeys,
): void {
  if (key == null) return
  for (let i = start; i < children.length; i++) {
    const child = children[i]
    const inner = composed.get(child)
    const base =
      inner !== undefined ? inner : child.$key != null ? child.$key : i - start
    composed.set(child, String(key) + String(base))
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
