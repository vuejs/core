import { Slot } from '../componentSlots'
import {
  setCurrentRenderingInstance,
  currentRenderingInstance
} from '../componentRenderUtils'
import { ComponentInternalInstance } from '../component'
import { setBlockTracking } from '../vnode'

/**
 * Wrap a slot function to memoize current rendering instance
 * @private
 */
export function withCtx(
  fn: Slot,
  ctx: ComponentInternalInstance | null = currentRenderingInstance
) {
  if (!ctx) return fn
  return function renderFnWithContext() {
    // By default, compiled slots disables block tracking since the user may
    // call it inside a template expression (#1745). It should only track when
    // it's called by a template `<slot>`.
    setBlockTracking(-1)
    const owner = currentRenderingInstance
    setCurrentRenderingInstance(ctx)
    const res = fn.apply(null, arguments as any)
    setCurrentRenderingInstance(owner)
    setBlockTracking(1)
    return res
  }
}
