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
import type { Block } from '../block'
import { isVaporComponent } from '../component'

export const vaporTransitionImpl: VaporTransitionInterface = {
  applyTransition: (
    props: TransitionProps,
    slots: { default: () => Block },
  ) => {
    const children = slots.default && slots.default()
    if (!children) return

    const child = findElementChild(children)
    if (!child) return

    const state = useTransitionState()
    let enterHooks = resolveTransitionHooks(
      child as any,
      props,
      state,
      currentInstance!,
      hooks => (enterHooks = hooks),
    )
    setTransitionHooks(child, enterHooks)

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

    child.applyTransitionLeavingHooks = (
      block: Block,
      afterLeaveCb: () => void,
    ) => {
      const leavingBlock = findElementChild(block)
      if (!leavingBlock) return undefined

      let leavingHooks = resolveTransitionHooks(
        leavingBlock as any,
        props,
        state,
        currentInstance!,
      )
      setTransitionHooks(leavingBlock, leavingHooks)

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
      return leavingHooks
    }

    return children
  },
}

const getTransitionHooksContext = (
  leavingNodeCache: Record<string, Block>,
  key: string,
  block: Block,
  props: TransitionProps,
  state: TransitionState,
  instance: GenericComponentInstance,
  postClone: ((hooks: TransitionHooks) => void) | undefined,
) => {
  const context: TransitionHooksContext = {
    setLeavingNodeCache: () => {
      leavingNodeCache[key] = block
    },
    unsetLeavingNodeCache: () => {
      if (leavingNodeCache[key] === block) {
        delete leavingNodeCache[key]
      }
    },
    earlyRemove: () => {
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
): TransitionHooks {
  const key = String(block.key)
  const leavingNodeCache = getLeavingNodesForBlock(state, block)
  const context = getTransitionHooksContext(
    leavingNodeCache,
    key,
    block,
    props,
    state,
    instance,
    postClone,
  )
  return baseResolveTransitionHooks(context, props, state, instance)
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

function setTransitionHooks(block: Block, hooks: TransitionHooks) {
  block.transition = hooks
}

function findElementChild(block: Block): Block | undefined {
  let child: Block | undefined
  // transition can only be applied on Element child
  if (block instanceof Element) {
    child = block
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
    // store transition hooks on fragment itself, so it can apply to both
    // previous and new branch during updates.
    child = block
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
