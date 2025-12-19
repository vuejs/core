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
  getComponentName,
  isAsyncWrapper,
  isTemplateNode,
  leaveCbKey,
  queuePostFlushCb,
  resolveTransitionProps,
  useTransitionState,
  warn,
} from '@vue/runtime-dom'
import type { Block, TransitionBlock, VaporTransitionHooks } from '../block'
import {
  type FunctionalVaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'
import { type VaporFragment, isFragment } from '../fragment'
import {
  currentHydrationNode,
  isHydrating,
  setCurrentHydrationNode,
} from '../dom/hydration'

const displayName = 'VaporTransition'

const decorate = (t: typeof VaporTransition) => {
  t.displayName = displayName
  t.props = TransitionPropsValidators
  t.__vapor = true
  return t
}

export const VaporTransition: FunctionalVaporComponent<TransitionProps> =
  /*@__PURE__*/ decorate((props, { slots }) => {
    // wrapped <transition appear>
    let resetDisplay: Function | undefined
    if (
      isHydrating &&
      currentHydrationNode &&
      isTemplateNode(currentHydrationNode)
    ) {
      // replace <template> node with inner child
      const {
        content: { firstChild },
        parentNode,
      } = currentHydrationNode
      if (firstChild) {
        if (
          firstChild instanceof HTMLElement ||
          firstChild instanceof SVGElement
        ) {
          const originalDisplay = firstChild.style.display
          firstChild.style.display = 'none'
          resetDisplay = () => (firstChild.style.display = originalDisplay)
        }

        parentNode!.replaceChild(firstChild, currentHydrationNode)
        setCurrentHydrationNode(firstChild)
      }
    }

    const children = (slots.default && slots.default()) as any as Block
    if (!children) return []

    const instance = currentInstance! as VaporComponentInstance
    const { mode } = props
    checkTransitionMode(mode)

    let resolvedProps: BaseTransitionProps<Element>
    renderEffect(() => (resolvedProps = resolveTransitionProps(props)))

    const hooks = applyTransitionHooks(children, {
      state: useTransitionState(),
      // use proxy to keep props reference stable
      props: new Proxy({} as BaseTransitionProps<Element>, {
        get(_, key) {
          return resolvedProps[key as keyof BaseTransitionProps<Element>]
        },
      }),
      instance: instance,
    } as VaporTransitionHooks)

    if (resetDisplay && resolvedProps!.appear) {
      const child = findTransitionBlock(children)!
      hooks.beforeEnter(child)
      resetDisplay()
      queuePostFlushCb(() => hooks.enter(child))
    }

    return children
  })

const getTransitionHooksContext = (
  key: string,
  props: TransitionProps,
  state: TransitionState,
  instance: GenericComponentInstance,
  postClone: ((hooks: TransitionHooks) => void) | undefined,
) => {
  const { leavingNodes } = state
  const context: TransitionHooksContext = {
    setLeavingNodeCache: el => {
      leavingNodes.set(key, el)
    },
    unsetLeavingNodeCache: el => {
      const leavingNode = leavingNodes.get(key)
      if (leavingNode === el) {
        leavingNodes.delete(key)
      }
    },
    earlyRemove: () => {
      const leavingNode = leavingNodes.get(key)
      if (leavingNode && (leavingNode as TransitionElement)[leaveCbKey]) {
        // force early removal (not cancelled)
        ;(leavingNode as TransitionElement)[leaveCbKey]!()
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
  block: TransitionBlock,
  props: TransitionProps,
  state: TransitionState,
  instance: GenericComponentInstance,
  postClone?: (hooks: TransitionHooks) => void,
): VaporTransitionHooks {
  const context = getTransitionHooksContext(
    String(block.$key),
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

export function applyTransitionHooks(
  block: Block,
  hooks: VaporTransitionHooks,
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

  const fragments: VaporFragment[] = []
  const child = findTransitionBlock(block, frag => fragments.push(frag))
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

  return resolvedHooks
}

export function applyTransitionLeaveHooks(
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
): void {
  const leavingBlock = findTransitionBlock(block)
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
      state.leavingNodes.set(String(leavingBlock.$key), leavingBlock)
      // early removal callback
      block[leaveCbKey] = () => {
        earlyRemove()
        block[leaveCbKey] = undefined
        leavingBlock.$transition = undefined
        delete enterHooks.delayedLeave
      }
      enterHooks.delayedLeave = () => {
        delayedLeave()
        leavingBlock.$transition = undefined
        delete enterHooks.delayedLeave
      }
    }
  }
}

export function findTransitionBlock(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
): TransitionBlock | undefined {
  let child: TransitionBlock | undefined
  if (block instanceof Node) {
    // transition can only be applied on Element child
    if (block instanceof Element) child = block
  } else if (isVaporComponent(block)) {
    // should save hooks on unresolved async wrapper, so that it can be applied after resolved
    if (isAsyncWrapper(block) && !block.type.__asyncResolved) {
      child = block
    } else {
      // stop searching if encountering nested Transition component
      if (getComponentName(block.type) === displayName) return undefined
      child = findTransitionBlock(block.block, onFragment)
      // use component id as key
      if (child && child.$key === undefined) child.$key = block.uid
    }
  } else if (isArray(block)) {
    let hasFound = false
    for (const c of block) {
      if (c instanceof Comment) continue
      const item = findTransitionBlock(c, onFragment)
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
    if (block.insert) {
      child = block
    } else {
      // collect fragments for setting transition hooks
      if (onFragment) onFragment(block)
      child = findTransitionBlock(block.nodes, onFragment)
    }
  }

  return child
}

export function setTransitionHooksOnFragment(
  block: Block,
  hooks: VaporTransitionHooks,
): void {
  if (isFragment(block)) {
    block.$transition = hooks
    if (block.nodes && isFragment(block.nodes)) {
      setTransitionHooksOnFragment(block.nodes, hooks)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      setTransitionHooksOnFragment(block[i], hooks)
    }
  }
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
