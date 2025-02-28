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
} from '@vue/runtime-dom'
import type { Block } from '../block'
import { isVaporComponent } from '../component'

export const vaporTransitionImpl: VaporTransitionInterface = {
  applyTransition: (
    props: TransitionProps,
    slots: { default: () => Block },
  ) => {
    const children = slots.default && slots.default()
    if (!children) {
      return
    }

    // TODO find non-comment node
    const child = children

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
    // TODO check mode

    child.applyLeavingHooks = (
      leavingBlock: Block,
      afterLeaveCb: () => void,
    ) => {
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

function resolveTransitionHooks(
  block: Block,
  props: TransitionProps,
  state: TransitionState,
  instance: GenericComponentInstance,
  postClone?: (hooks: TransitionHooks) => void,
): TransitionHooks {
  const key = String(block.key)
  const leavingNodeCache = getLeavingNodesForBlock(state, block)
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
  if (isVaporComponent(block)) {
    setTransitionHooks(block.block, hooks)
  } else {
    block.transition = hooks
  }
}

let registered = false
export function ensureVaporTransition(): void {
  if (!registered) {
    registerVaporTransition(vaporTransitionImpl)
    registered = true
  }
}
