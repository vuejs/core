import { EffectFlags, pauseScope, resumeScope } from '@vue/reactivity'
import type {
  ComponentInternalInstance,
  GenericComponentInstance,
} from './component'
import {
  restoreCurrentInstance,
  setCurrentInstance,
} from './componentCurrentInstance'
import {
  type SchedulerJob,
  SchedulerJobFlags,
  flushOwnedJobs,
  hasQueuedJobs,
  queuePostFlushCb,
} from './scheduler'

const entries = new WeakSet<GenericComponentInstance>()
let resuming: GenericComponentInstance | null = null

/**
 * An entry of a KeepAlive with `pause` counts as paused from its deactivation
 * on, though its scope only pauses once its deactivated hooks have run.
 * @internal
 */
export function isPausedKeepAliveEntry(
  instance: GenericComponentInstance,
): boolean {
  return entries.has(instance)
}

/**
 * A resuming entry renders what it missed before its deactivated state is
 * lifted.
 * @internal
 */
export function isResumingKeepAliveEntry(
  instance: GenericComponentInstance,
): boolean {
  return resuming === instance
}

/**
 * Marks a component KeepAlive is deactivating, to be paused by
 * `pauseKeepAliveEntry` once its deactivated hooks have run, if that KeepAlive
 * (its parent) has `pause` set.
 * @internal
 */
export function requestPauseKeepAliveEntry(
  instance: GenericComponentInstance,
): void {
  if (instance.parent!.props.pause) entries.add(instance)
}

/**
 * Pauses a deactivated entry, with its subtree, after the updates its
 * deactivated hooks made, e.g. closing a teleported modal: those can go on
 * through renders and post watchers, so it waits for the queue to drain. An
 * entry activated or unmounted in the meantime is left alone.
 * @internal
 */
export function pauseKeepAliveEntry(instance: GenericComponentInstance): void {
  if (!entries.has(instance)) return
  toPause.push(instance)
  // queues itself again
  pauseDrained.flags! |= SchedulerJobFlags.ALLOW_RECURSE
  queuePostFlushCb(pauseDrained)
}

// one job for all, as each would wait for the others
const toPause: GenericComponentInstance[] = []
const pauseDrained: SchedulerJob = () => {
  if (hasQueuedJobs()) return queuePostFlushCb(pauseDrained)
  for (let i = 0; i < toPause.length; i++) {
    const instance = toPause[i]
    if (entries.has(instance) && instance.scope.active) {
      pauseScope(instance.scope, EffectFlags.RUNTIME_PAUSED)
    }
  }
  toPause.length = 0
}

/**
 * Resumes a paused entry, which is back in place: its effects catch up now,
 * with the work queued inside it, as they would have while it was deactivated.
 * @internal
 */
export function resumeKeepAliveEntry(root: GenericComponentInstance): void {
  if (
    !entries.delete(root) ||
    !(root.scope.flags & EffectFlags.RUNTIME_PAUSED)
  ) {
    return
  }
  // outside the activating component, as in a scheduler flush
  const prev = setCurrentInstance(null)
  const prevResuming = resuming
  resuming = root
  try {
    resumeScope(root.scope, EffectFlags.RUNTIME_PAUSED)
    // patched while paused: it renders before its watchers, as on the patch
    if ((root as ComponentInternalInstance).next) {
      ;(root as ComponentInternalInstance).effect.run()
    }
    flushOwnedJobs(root)
  } finally {
    resuming = prevResuming
    restoreCurrentInstance(prev)
  }
}
