import { Slot } from '../componentSlots'
import { ComponentInternalInstance } from '../component'
import {
  setCurrentRenderingInstance,
  currentRenderingInstance
} from '../componentRenderUtils'

export function withCtx(fn: Slot, ctx: ComponentInternalInstance) {
  return function renderFnWithContext() {
    const owner = currentRenderingInstance
    setCurrentRenderingInstance(ctx)
    const res = fn.apply(null, arguments)
    setCurrentRenderingInstance(owner)
    return res
  }
}
