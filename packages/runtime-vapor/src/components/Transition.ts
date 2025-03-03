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

    applyTransitionEnterHooks(
      children,
      useTransitionState(),
      props,
      undefined,
      false,
    )

    return children
  },
}

const getTransitionHooksContext = (
  key: string,
  block: Block,
  props: TransitionProps,
  state: TransitionState,
  instance: GenericComponentInstance,
  postClone: ((hooks: TransitionHooks) => void) | undefined,
) => {
  const context: TransitionHooksContext = {
    setLeavingNodeCache: el => {
      const leavingNodeCache = getLeavingNodesForBlock(state, block)
      leavingNodeCache[key] = el
    },
    unsetLeavingNodeCache: el => {
      const leavingNodeCache = getLeavingNodesForBlock(state, block)
      if (leavingNodeCache[key] === el) {
        delete leavingNodeCache[key]
      }
    },
    earlyRemove: () => {
      const leavingNodeCache = getLeavingNodesForBlock(state, block)
      const leavingNode = leavingNodeCache[key]
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
  const key = String(block.key)
  const context = getTransitionHooksContext(
    key,
    block,
    props,
    state,
    instance,
    postClone,
  )
  const hooks: VaporTransitionHooks = baseResolveTransitionHooks(
    context,
    props,
    state,
    instance,
  )
  hooks.state = state
  hooks.props = props
  return hooks
}

function getLeavingNodesForBlock(
  state: TransitionState,
  block: Block,
): Record<string, Block> {
  const { leavingVNodes } = state
  let leavingNodesCache = leavingVNodes.get(block)!
  if (!leavingNodesCache) {
    leavingNodesCache = Object.create(null)
    leavingVNodes.set(block, leavingNodesCache)
  }
  return leavingNodesCache
}

function setTransitionHooks(block: Block, hooks: VaporTransitionHooks) {
  if (!isFragment(block)) {
    block.transition = hooks
  }
}

export function applyTransitionEnterHooks(
  block: Block,
  state: TransitionState,
  props: TransitionProps,
  enterHooks?: VaporTransitionHooks,
  clone: boolean = true,
): Block | undefined {
  const child = findElementChild(block)
  if (child) {
    if (!enterHooks) {
      enterHooks = resolveTransitionHooks(
        child,
        props,
        state,
        currentInstance!,
        hooks => (enterHooks = hooks),
      )
    }

    setTransitionHooks(
      child,
      clone ? enterHooks.clone(child as any) : enterHooks,
    )

    if (isFragment(block)) {
      block.transitionChild = child
    }
  }
  return child
}

export function applyTransitionLeaveHooks(
  block: Block,
  state: TransitionState,
  props: TransitionProps,
  afterLeaveCb: () => void,
  enterHooks: TransitionHooks,
): void {
  const leavingBlock = findElementChild(block)
  if (!leavingBlock) return undefined

  let leavingHooks = resolveTransitionHooks(
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
      delete leavingHooks.afterLeave
    }
  } else if (mode === 'in-out') {
    leavingHooks.delayLeave = (
      block: TransitionElement,
      earlyRemove,
      delayedLeave,
    ) => {
      const leavingNodeCache = getLeavingNodesForBlock(state, leavingBlock)
      leavingNodeCache[String(leavingBlock.key)] = leavingBlock
      // early removal callback
      block[leaveCbKey] = () => {
        earlyRemove()
        block[leaveCbKey] = undefined
        delete enterHooks.delayedLeave
      }
      enterHooks.delayedLeave = () => {
        delayedLeave()
        delete enterHooks.delayedLeave
      }
    }
  }
}

export function findElementChild(block: Block): Block | undefined {
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
