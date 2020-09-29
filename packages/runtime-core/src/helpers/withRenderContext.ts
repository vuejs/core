import { Slot } from '../componentSlots'
import {
  setCurrentRenderingInstance,
  currentRenderingInstance
} from '../componentRenderUtils'
import { ComponentInternalInstance } from '../component'
import { isRenderingCompiledSlot } from './renderSlot'
import { closeBlock, openBlock } from '../vnode'

/**
 * Wrap a slot function to memoize current rendering instance
 * @private
 */
export function withCtx(
  fn: Slot,
  ctx: ComponentInternalInstance | null = currentRenderingInstance
) {
  if (!ctx) return fn
  const renderFnWithContext = (...args: any[]) => {
    // If a user calls a compiled slot inside a template expression (#1745), it
    // can mess up block tracking, so by default we need to push a null block to
    // avoid that. This isn't necessary if rendering a compiled `<slot>`.
    if (!isRenderingCompiledSlot) {
      openBlock(true /* null block that disables tracking */)
    }
    const owner = currentRenderingInstance
    setCurrentRenderingInstance(ctx)
    const res = fn(...args)
    setCurrentRenderingInstance(owner)
    if (!isRenderingCompiledSlot) {
      closeBlock()
    }
    return res
  }
  renderFnWithContext._c = true
  return renderFnWithContext
}
