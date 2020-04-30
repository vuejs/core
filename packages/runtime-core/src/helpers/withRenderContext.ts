import { Slot } from '../componentSlots'
import {
  setCurrentRenderingInstance,
  currentRenderingInstance
} from '../componentRenderUtils'
import { ComponentInternalInstance } from '../component'

export function withCtx(
  fn: Slot,
  ctx: ComponentInternalInstance | null = currentRenderingInstance
) {
  if (!ctx) return fn
  return function renderFnWithContext() {
    const owner = currentRenderingInstance
    setCurrentRenderingInstance(ctx)
    const res = fn.apply(null, arguments as any)
    setCurrentRenderingInstance(owner)
    return res
  }
}
