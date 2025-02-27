import {
  type TransitionHooks,
  type TransitionProps,
  type VaporTransitionInterface,
  currentInstance,
  registerVaporTransition,
  resolveTransitionHooks,
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

    child.applyLeavingHooks = (block: Block, afterLeaveCb: () => void) => {
      let leavingHooks = resolveTransitionHooks(
        block as any,
        props,
        state,
        currentInstance!,
      )
      setTransitionHooks(block, leavingHooks)

      if (mode === 'out-in') {
        state.isLeaving = true
        leavingHooks.afterLeave = () => {
          state.isLeaving = false
          afterLeaveCb()
          delete leavingHooks.afterLeave
        }
      } else if (mode === 'in-out') {
        leavingHooks.delayLeave = (block: Block, earlyRemove, delayedLeave) => {
          // TODO delay leave
        }
      }
      return leavingHooks
    }

    return children
  },
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
