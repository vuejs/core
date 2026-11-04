import type { Block } from './block'
import { type SchedulerJob, SchedulerJobFlags } from '@vue/runtime-dom'

export interface RefCleanupState {
  fn: () => void
  job?: SchedulerJob
}

/**
 * Stores ref cleanup functions keyed by the element/component they are set on.
 * Shared between apiTemplateRef.ts (writes) and KeepAlive deactivate (reads).
 */
export const refCleanups: WeakMap<Block, RefCleanupState> = new WeakMap()

export function invalidatePendingRef(el: Block): void {
  const c = refCleanups.get(el)
  if (c && c.job) {
    c.job.flags = c.job.flags! | SchedulerJobFlags.DISPOSED
    c.job = undefined
  }
}

/**
 * Synchronously clear the ref for an element being deactivated by KeepAlive.
 * In VDOM core, refs are cleared during unmount before the deactivation check.
 * Since Vapor's KeepAlive retains scopes (skipping onScopeDispose), we need
 * this explicit sync cleanup path.
 */
export function unsetRef(el: Block): void {
  invalidatePendingRef(el)
  const c = refCleanups.get(el)
  if (c) c.fn()
}
