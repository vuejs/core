import {
  type GenericComponentInstance,
  type TransitionElement,
  type TransitionHooks,
  type TransitionHooksContext,
  type TransitionProps,
  type TransitionState,
  type VaporTransitionInterface,
  baseResolveTransitionHooks,
  currentInstance,
  leaveCbKey,
  registerVaporTransition,
  useTransitionState,
  warn,
} from '@vue/runtime-dom'
import { type Block, type VaporTransitionHooks, isFragment } from '../block'
import { isVaporComponent } from '../component'

export const vaporTransitionImpl: VaporTransitionInterface = {
  applyTransition: (
    props: TransitionProps,
    slots: { default: () => Block },
  ) => {
    const children = slots.default && slots.default()
    if (!children) return

    const { mode } = props
    if (
      __DEV__ &&
      mode &&
      mode !== 'in-out' &&
      mode !== 'out-in' &&
      mode !== 'default'
    ) {
      warn(`invalid <transition> mode: ${mode}`)
    }

    applyTransitionEnterHooks(children, {
      state: useTransitionState(),
      props,
    } as VaporTransitionHooks)

    return children
  },
}

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

function resolveTransitionHooks(
  block: Block,
  props: TransitionProps,
  state: TransitionState,
  instance: GenericComponentInstance,
  postClone?: (hooks: TransitionHooks) => void,
): VaporTransitionHooks {
  const context = getTransitionHooksContext(
    String(block.key),
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

function setTransitionHooks(block: Block, hooks: VaporTransitionHooks) {
  if (!isFragment(block)) {
    block.$transition = hooks
  }
}

export function applyTransitionEnterHooks(
  block: Block,
  hooks: VaporTransitionHooks,
): VaporTransitionHooks | undefined {
  const child = findElementChild(block)
  let enterHooks
  if (child) {
    const { props, state, delayedLeave } = hooks
    enterHooks = resolveTransitionHooks(
      child,
      props,
      state,
      currentInstance!,
      hooks => (enterHooks = hooks as VaporTransitionHooks),
    )
    enterHooks.delayedLeave = delayedLeave
    setTransitionHooks(child, enterHooks)
    if (isFragment(block)) {
      block.$transition = enterHooks
    }
  }
  return enterHooks
}

export function applyTransitionLeaveHooks(
  block: Block,
  enterHooks: VaporTransitionHooks,
  afterLeaveCb: () => void,
): void {
  const leavingBlock = findElementChild(block)
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
      state.leavingNodes.set(String(leavingBlock.key), leavingBlock)
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

const transitionChildCache = new WeakMap<Block, Block>()
export function findElementChild(block: Block): Block | undefined {
  if (transitionChildCache.has(block)) {
    return transitionChildCache.get(block)
  }

  let child: Block | undefined
  if (block instanceof Node) {
    // transition can only be applied on Element child
    if (block instanceof Element) child = block
  } else if (isVaporComponent(block)) {
    child = findElementChild(block.block)
  } else if (Array.isArray(block)) {
    child = block[0]
    let hasFound = false
    for (const c of block) {
      const item = findElementChild(c)
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
  } else {
    // fragment
    child = findElementChild(block.nodes)
  }

  if (__DEV__ && !child) {
    warn('Transition component has no valid child element')
  }

  return child
}

let registered = false
export function ensureVaporTransition(): void {
  if (!registered) {
    registerVaporTransition(vaporTransitionImpl)
    registered = true
  }
}
