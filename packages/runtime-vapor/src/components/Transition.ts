import {
  type FunctionalComponent,
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
  leaveCbKey,
  resolveTransitionProps,
  useTransitionState,
  warn,
} from '@vue/runtime-dom'
import {
  type Block,
  type TransitionBlock,
  type VaporTransitionHooks,
  isFragment,
} from '../block'
import { type VaporComponentInstance, isVaporComponent } from '../component'
import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'

const decorate = (t: typeof VaporTransition) => {
  t.displayName = 'VaporTransition'
  t.props = TransitionPropsValidators
  t.__vapor = true
  return t
}

export const VaporTransition: FunctionalComponent<TransitionProps> =
  /*@__PURE__*/ decorate((props, { slots }) => {
    const children = (slots.default && slots.default()) as any as Block
    if (!children) return

    const { mode } = props
    checkTransitionMode(mode)

    let resolvedProps
    renderEffect(() => {
      resolvedProps = resolveTransitionProps(props)
      // only update props for Fragment block, for later reusing
      if (isFragment(children) && children.$transition) {
        children.$transition.props = resolvedProps
      } else {
        // replace existing transition hooks
        const child = findTransitionBlock(children)
        if (child && child.$transition) {
          child.$transition.props = resolvedProps
          applyTransitionHooks(child, child.$transition)
        }
      }
    })

    applyTransitionHooks(children, {
      state: useTransitionState(),
      props: resolvedProps!,
    } as VaporTransitionHooks)

    return children
  })

const getTransitionHooksContext = (
  key: String,
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
  return hooks
}

export function applyTransitionHooks(
  block: Block,
  hooks: VaporTransitionHooks,
): VaporTransitionHooks {
  const child = findTransitionBlock(block)
  if (!child) return hooks

  const { props, state, delayedLeave } = hooks
  let resolvedHooks = resolveTransitionHooks(
    child,
    props,
    state,
    currentInstance!,
    hooks => (resolvedHooks = hooks as VaporTransitionHooks),
  )
  resolvedHooks.delayedLeave = delayedLeave
  setTransitionHooks(child, resolvedHooks)
  if (isFragment(block)) {
    // also set transition hooks on fragment for reusing during it's updating
    setTransitionHooksToFragment(block, resolvedHooks)
  }
  return resolvedHooks
}

export function applyTransitionLeaveHooks(
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
): void {
  const leavingBlock = findTransitionBlock(block)
  if (!leavingBlock) return undefined

  const { props, state } = enterHooks
  const leavingHooks = resolveTransitionHooks(
    leavingBlock,
    props,
    state,
    currentInstance!,
  )
  setTransitionHooks(leavingBlock, leavingHooks)

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

const transitionBlockCache = new WeakMap<Block, TransitionBlock>()
export function findTransitionBlock(block: Block): TransitionBlock | undefined {
  if (transitionBlockCache.has(block)) {
    return transitionBlockCache.get(block)
  }

  let child: TransitionBlock | undefined
  if (block instanceof Node) {
    // transition can only be applied on Element child
    if (block instanceof Element) child = block
  } else if (isVaporComponent(block)) {
    child = findTransitionBlock(block.block)
    if (child && child.$key === undefined) child.$key = block.type.__name
  } else if (isArray(block)) {
    child = block[0] as TransitionBlock
    let hasFound = false
    for (const c of block) {
      const item = findTransitionBlock(c)
      if (item instanceof Element) {
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
    }
  } else if (isFragment(block)) {
    if (block.insert) {
      child = block
    } else {
      child = findTransitionBlock(block.nodes)
    }
  }

  if (__DEV__ && !child) {
    warn('Transition component has no valid child element')
  }

  return child
}

export function setTransitionToInstance(
  block: VaporComponentInstance,
  hooks: VaporTransitionHooks,
): void {
  const child = findTransitionBlock(block.block)
  if (!child) return

  setTransitionHooks(child, hooks)
}

export function setTransitionHooksToFragment(
  block: Block,
  hooks: VaporTransitionHooks,
): void {
  if (isFragment(block)) {
    setTransitionHooks(block, hooks)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      setTransitionHooksToFragment(block[i], hooks)
    }
  }
}

export function setTransitionHooks(
  block: TransitionBlock,
  hooks: VaporTransitionHooks,
): void {
  block.$transition = hooks
}
