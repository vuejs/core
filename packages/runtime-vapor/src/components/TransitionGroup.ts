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
  queuePostFlushCb,
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
import { setForHydrationAnchorResolver } from '../apiCreateFor'
import { createComment, createElement, createTextNode } from '../dom/node'
import {
  DynamicFragment,
  type VaporFragment,
  isForBlock,
  isFragment,
  isSlotFragment,
} from '../fragment'
import { DYNAMIC, OWNS_ANCHOR } from '../fragmentFlags'
import {
  type DefineVaporComponent,
  defineVaporComponent,
} from '../apiDefineComponent'
import { EffectFlags, ReactiveEffect } from '@vue/reactivity'
import {
  adoptTemplate,
  claimAnchor,
  cleanupHydrationTail,
  currentHydrationNode,
  isHydrating,
  nextLogicalSibling,
  setCurrentHydrationNode,
} from '../dom/hydration'
import { isTransitionEnabled, registerTransitionHooks } from '../transition'
import { isInteropEnabled } from '../vdomInteropState'

const positionMap = new WeakMap<TransitionBlock, DOMRect>()
const newPositionMap = new WeakMap<TransitionBlock, DOMRect>()

type TransitionGroupUpdateOwner = VaporFragment | VaporComponentInstance

type TransitionGroupUpdateHookRef = {
  beforeUpdate: () => void
  updated: () => void
}

// Each owner installs its update callback once. The stored hook object lets
// that callback keep pointing at the latest TransitionGroup update hooks.
const transitionGroupUpdateOwnerMap = new WeakMap<
  TransitionGroupUpdateOwner,
  TransitionGroupUpdateHookRef
>()

let isForHydrationAnchorResolverRegistered = false
let currentForHydrationContainer: ParentNode | undefined

function ensureForHydrationAnchorResolver(): void {
  if (isForHydrationAnchorResolverRegistered) return
  isForHydrationAnchorResolverRegistered = true
  setForHydrationAnchorResolver((hydrationStart, anchorNode) => {
    const container = currentForHydrationContainer
    if (!container) return
    if (
      hydrationStart !== container &&
      hydrationStart.parentNode !== container
    ) {
      return
    }

    const anchor =
      anchorNode &&
      anchorNode !== container &&
      anchorNode.parentNode === container
        ? anchorNode
        : null
    const parentAnchor = claimAnchor(
      __DEV__ ? createComment('for') : createTextNode(),
    )
    container.insertBefore(parentAnchor, anchor)
    return parentAnchor
  })
}

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
          // Skip enter/move while children are placed for FLIP measurement.
          // Leave still needs to run for removed children.
          child.$transition!.disabled = true
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
      prevChildren.forEach(child => {
        child.$transition!.disabled = false
        if (hasMove) {
          // pending enter/move cbs live on the element, which for interop
          // children is not the block itself
          const el = getTransitionElement(child)
          if (el) callPendingCbs(el)
        }
      })
      if (!hasMove) {
        prevChildren = []
        return
      }

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
    const updateHooks: TransitionGroupUpdateHookRef = { beforeUpdate, updated }

    const frag = new DynamicFragment(
      DYNAMIC | OWNS_ANCHOR,
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
      let prevForHydrationContainer: ParentNode | undefined
      if (isHydrating && container) {
        // `transition-group + v-for` SSR output does not include `<!--]-->`.
        // Expose the container so `v-for` hydration can create its own anchor.
        ensureForHydrationAnchorResolver()
        prevForHydrationContainer = currentForHydrationContainer
        currentForHydrationContainer = container
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
          currentForHydrationContainer = prevForHydrationContainer
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

type InheritedTransitionKeyRecord = {
  generation: number
  rawBaseKey: any
  inheritedKey: string
}

const inheritedTransitionKeyMap = new WeakMap<
  ResolvedTransitionBlock,
  InheritedTransitionKeyRecord
>()
let transitionKeyGeneration = 0
let currentTransitionKeyGeneration = 0

export function resolveTransitionBlocks(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
  onUpdateOwner?: (owner: TransitionGroupUpdateOwner) => void,
  // collect elements only, skipping key/type inheritance side effects
  collectOnly = false,
): ResolvedTransitionBlock[] {
  const children: ResolvedTransitionBlock[] = []
  if (collectOnly) {
    collectTransitionBlocks(block, children, onFragment, onUpdateOwner, true)
    return children
  }
  const prevGeneration = currentTransitionKeyGeneration
  currentTransitionKeyGeneration = ++transitionKeyGeneration
  try {
    collectTransitionBlocks(block, children, onFragment, onUpdateOwner)
    return children
  } finally {
    currentTransitionKeyGeneration = prevGeneration
  }
}

function collectTransitionBlocks(
  block: Block,
  children: ResolvedTransitionBlock[],
  onFragment?: (frag: VaporFragment) => void,
  onUpdateOwner?: (owner: TransitionGroupUpdateOwner) => void,
  collectOnly = false,
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
      collectOnly,
    )
    if (!collectOnly) {
      if (!isRootSlot) {
        for (let i = start; i < children.length; i++) {
          setTransitionType(children[i], block.type)
        }
      }
      inheritTransitionKey(children, start, block.$key)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      collectTransitionBlocks(
        block[i],
        children,
        onFragment,
        onUpdateOwner,
        collectOnly,
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
    if (isInteropEnabled && block.vnode) {
      children.push(block)
    } else {
      const start = children.length
      collectTransitionBlocks(
        block.nodes,
        children,
        onFragment,
        onUpdateOwner,
        collectOnly,
      )
      if (collectOnly) {
        // element collection only; keys were stamped by the apply pass
      } else if (isItem) {
        const count = children.length - start
        for (let i = start; i < children.length; i++) {
          children[i].$key =
            block.key != null && count > 1
              ? `${block.key}:${i - start}`
              : block.key
        }
      } else {
        inheritTransitionKey(children, start, block.$key)
      }
    }
  }
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

function applyGroupTransitionHooks(
  block: Block,
  props: TransitionProps,
  state: TransitionState,
  instance: VaporComponentInstance,
  updateHooks: TransitionGroupUpdateHookRef,
): ResolvedTransitionBlock[] {
  const fragments: VaporFragment[] = []
  const children = resolveTransitionBlocks(
    block,
    frag => fragments.push(frag),
    owner => trackTransitionGroupUpdate(owner, updateHooks),
  )
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isValidTransitionBlock(child)) {
      if (child.$key != null) {
        const prev = child.$transition
        child.$transition = resolveTransitionHooks(
          child,
          props,
          state,
          instance,
        )
        // Carry the FLIP-measurement latch across hook re-resolution (a props
        // re-apply or slot re-render can land between beforeUpdate and
        // flushUpdated); flushUpdated resets it on the live hooks object.
        if (prev && prev.disabled) child.$transition.disabled = true
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
  updateHooks: TransitionGroupUpdateHookRef,
): void {
  const registeredHooks = transitionGroupUpdateOwnerMap.get(owner)
  if (registeredHooks) {
    registeredHooks.beforeUpdate = updateHooks.beforeUpdate
    registeredHooks.updated = updateHooks.updated
    return
  }

  if (isFragment(owner)) {
    transitionGroupUpdateOwnerMap.set(owner, updateHooks)
    ;(owner.onBeforeUpdate ||= []).push(() => updateHooks.beforeUpdate())
    ;(owner.onUpdated ||= []).push(() => updateHooks.updated())
    return
  }

  // Fully static raw props can never notify - skip the tracking effect.
  if (!hasDynamicPropsSource(owner.rawProps)) return

  transitionGroupUpdateOwnerMap.set(owner, updateHooks)
  // A component child can update from parent-driven props without re-running
  // the surrounding v-for fragment. Track raw props directly instead of
  // using component updated hooks, because child-local state updates should
  // not trigger TransitionGroup move bookkeeping. This matches VDOM behavior.
  let isPending = false
  owner.scope.run(() => {
    const effect = new ReactiveEffect(() => {
      // Dynamic prop sources are resolved as child props, so the getter
      // must run with the child instance while the effect itself remains
      // owned by the child scope for teardown.
      const prev = setCurrentInstance(owner, owner.scope)
      try {
        resolveDynamicProps(owner.rawProps)
      } finally {
        restoreCurrentInstance(prev)
      }
    })
    const flushUpdated = () => {
      isPending = false
      // Deferred re-track: `dirty` stays set until this run and `isPending`
      // short-circuits the notifies in between, so a batch touching N props
      // of one child resolves them once instead of N times.
      if (effect.active) effect.run()
      updateHooks.updated()
    }
    effect.notify = () => {
      if (effect.flags & EffectFlags.PAUSED || !effect.dirty) return
      if (isPending) return
      isPending = true
      updateHooks.beforeUpdate()
      queuePostFlushCb(flushUpdated)
    }
    effect.run()
  })
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
