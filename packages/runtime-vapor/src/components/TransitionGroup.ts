import {
  type BaseTransitionProps,
  type ElementWithTransition,
  type TransitionGroupProps,
  type TransitionProps,
  TransitionPropsValidators,
  type TransitionState,
  baseApplyTranslation,
  callPendingCbs,
  currentInstance,
  forceReflow,
  handleMovedChildren,
  hasCSSTransform,
  onBeforeUpdate,
  onUpdated,
  queuePostFlushCb,
  resolveTransitionProps,
  setCurrentInstance,
  useTransitionState,
  warn,
} from '@vue/runtime-dom'
import { extend, isArray } from '@vue/shared'
import {
  type Block,
  type BlockFn,
  type TransitionBlock,
  insert,
} from '../block'
import { renderEffect } from '../renderEffect'
import {
  type ResolvedTransitionBlock,
  ensureTransitionHooksRegistered,
  getTransitionElementFromVNode,
  resolveTransitionHooks,
  setTransitionHooks,
} from './Transition'
import {
  type VaporComponentInstance,
  type VaporComponentOptions,
  isVaporComponent,
} from '../component'
import { resolveDynamicProps } from '../componentProps'
import { isForBlock, setForHydrationAnchorResolver } from '../apiCreateFor'
import { createComment, createElement, createTextNode } from '../dom/node'
import { DynamicFragment, type VaporFragment, isFragment } from '../fragment'
import {
  type DefineVaporComponent,
  defineVaporComponent,
} from '../apiDefineComponent'
import { watch } from '@vue/reactivity'
import { isInteropEnabled } from '../vdomInteropState'
import {
  adoptTemplate,
  cleanupHydrationTail,
  currentHydrationNode,
  isHydrating,
  markHydrationAnchor,
  nextLogicalSibling,
  setCurrentHydrationNode,
} from '../dom/hydration'

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
    const parentAnchor = markHydrationAnchor(
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

const VaporTransitionGroupImpl = defineVaporComponent({
  name: 'VaporTransitionGroup',

  props: /*@__PURE__*/ extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String,
  }),

  setup(props: TransitionGroupProps, { slots, expose }) {
    // @ts-expect-error
    expose()

    // Register transition hooks on first use
    ensureTransitionHooksRegistered()

    const instance = currentInstance as VaporComponentInstance
    const state = useTransitionState()

    // use proxy to keep props reference stable
    let cssTransitionProps!: BaseTransitionProps<Element>
    const propsProxy = new Proxy({} as BaseTransitionProps<Element>, {
      get(_, key) {
        return cssTransitionProps[key as keyof BaseTransitionProps<Element>]
      },
    })

    renderEffect(
      () => (cssTransitionProps = resolveTransitionProps(props)),
      true,
    )

    let prevChildren: ResolvedTransitionBlock[] = []
    // Multiple child owners can update in the same flush (e.g. a VDOM child
    // props update plus the surrounding v-for keyed diff). Keep the first
    // position snapshot until the matching updated hook applies the move.
    let isUpdatePending = false
    let slottedBlock: Block = []

    const beforeUpdate = () => {
      if (isUpdatePending) return
      isUpdatePending = true
      prevChildren = []
      const children = getTransitionBlocks(slottedBlock)
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const el =
          isValidTransitionBlock(child) && child.$transition
            ? getTransitionElement(child)
            : undefined
        if (el) {
          prevChildren.push(child)
          // disabled transition during enter, so the children will be
          // inserted into the correct position immediately. this prevents
          // `recordPosition` from getting incorrect positions in `onUpdated`
          child.$transition!.disabled = true
          positionMap.set(child, el.getBoundingClientRect())
        }
      }
    }

    const updated = () => {
      if (!isUpdatePending) return
      isUpdatePending = false
      if (!prevChildren.length) {
        return
      }
      const moveClass = props.moveClass || `${props.name || 'v'}-move`
      const firstChild = getFirstConnectedChild(prevChildren)
      if (
        !firstChild ||
        !hasCSSTransform(
          firstChild as ElementWithTransition,
          firstChild.parentNode as Node,
          moveClass,
        )
      ) {
        prevChildren = []
        return
      }

      prevChildren.forEach(callPendingCbs)
      prevChildren.forEach(child => {
        child.$transition!.disabled = false
        recordPosition(child)
      })
      const movedChildren = prevChildren.filter(applyTranslation)

      // force reflow to put everything in position
      forceReflow()

      movedChildren.forEach(c =>
        handleMovedChildren(
          getTransitionElement(c) as ElementWithTransition,
          moveClass,
        ),
      )
      prevChildren = []
    }

    onBeforeUpdate(beforeUpdate)
    onUpdated(updated)

    const frag = new DynamicFragment('transition-group')
    let currentTag: string | undefined
    let currentSlot: BlockFn | undefined
    let isMounted = false

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
            { beforeUpdate, updated },
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

function applyGroupTransitionHooks(
  block: Block,
  props: TransitionProps,
  state: TransitionState,
  instance: VaporComponentInstance,
  updateHooks: TransitionGroupUpdateHookRef,
): ResolvedTransitionBlock[] {
  const fragments: VaporFragment[] = []
  const children = getTransitionBlocks(
    block,
    frag => fragments.push(frag),
    owner => trackTransitionGroupUpdate(owner, updateHooks),
  )
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isValidTransitionBlock(child)) {
      if (child.$key != null) {
        setTransitionHooks(
          child,
          resolveTransitionHooks(child, props, state, instance),
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
  updateHooks: TransitionGroupUpdateHookRef,
): void {
  const registeredHooks = transitionGroupUpdateOwnerMap.get(owner)
  if (registeredHooks) {
    registeredHooks.beforeUpdate = updateHooks.beforeUpdate
    registeredHooks.updated = updateHooks.updated
    return
  }

  transitionGroupUpdateOwnerMap.set(owner, updateHooks)
  if (isFragment(owner)) {
    ;(owner.onBeforeUpdate ||= []).push(() => updateHooks.beforeUpdate())
    ;(owner.onUpdated ||= []).push(() => updateHooks.updated())
  } else {
    // A component child can update from parent-driven props without re-running
    // the surrounding v-for fragment. Watch raw props directly instead of
    // using component updated hooks, because child-local state updates should
    // not trigger TransitionGroup move bookkeeping. This matches VDOM behavior.
    let isPending = false
    const flushUpdated = () => {
      isPending = false
      updateHooks.updated()
    }
    owner.scope.run(() => {
      watch(
        () => {
          // Dynamic prop sources are resolved as child props, so the getter
          // must run with the child instance while the watcher itself remains
          // owned by the child scope for teardown.
          const prev = setCurrentInstance(owner, owner.scope)
          try {
            return resolveDynamicProps(owner.rawProps)
          } finally {
            setCurrentInstance(...prev)
          }
        },
        () => {
          if (isPending) return
          isPending = true
          updateHooks.beforeUpdate()
          queuePostFlushCb(flushUpdated)
        },
      )
    })
  }
}

function inheritKey(children: TransitionBlock[], key: any): void {
  if (key === undefined || children.length === 0) return
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    child.$key = String(key) + String(child.$key != null ? child.$key : i)
  }
}

function getTransitionBlocks(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
  onUpdateOwner?: (owner: TransitionGroupUpdateOwner) => void,
): ResolvedTransitionBlock[] {
  let children: ResolvedTransitionBlock[] = []
  if (block instanceof Element) {
    children.push(block)
  } else if (isVaporComponent(block)) {
    if (onUpdateOwner) onUpdateOwner(block)
    const blocks = getTransitionBlocks(block.block, onFragment, onUpdateOwner)
    inheritKey(blocks, block.$key)
    children.push(...blocks)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      const b = block[i]
      const blocks = getTransitionBlocks(b, onFragment, onUpdateOwner)
      if (isForBlock(b)) blocks.forEach(block => (block.$key = b.key))
      children.push(...blocks)
    }
  } else if (isFragment(block)) {
    if (onFragment) onFragment(block)
    if (onUpdateOwner) onUpdateOwner(block)
    if (isInteropEnabled && block.vnode) {
      // vdom component
      children.push(block)
    } else {
      const blocks = getTransitionBlocks(block.nodes, onFragment, onUpdateOwner)
      inheritKey(blocks, block.$key)
      children.push(...blocks)
    }
  }

  return children
}

function isValidTransitionBlock(
  block: Block,
): block is ResolvedTransitionBlock {
  return !!(block instanceof Element || (isFragment(block) && block.vnode))
}

function getTransitionElement(
  block: ResolvedTransitionBlock,
): Element | undefined {
  if (block instanceof Element) return block

  // vdom interop
  if (isInteropEnabled && isFragment(block) && block.vnode) {
    return getTransitionElementFromVNode(block.vnode)
  }
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
