import {
  EffectFlags,
  type EffectScope,
  ReactiveEffect,
  onScopeDispose,
} from '@vue/reactivity'
import {
  type SchedulerJob,
  SchedulerJobFlags,
  currentInstance,
  endMeasure,
  queueJob,
  queuePostRenderEffect,
  restoreCurrentInstance,
  setCurrentInstance,
  startMeasure,
  warn,
} from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  isDeferredKeepAliveStateLive,
  isVaporComponent,
  settleDeferredKeepAliveUpdates,
} from './component'
import { inOnce } from './once'
import { invokeArrayFns, remove } from '@vue/shared'
import { isSuspenseEnabled } from './suspense'
import { isInteropEnabled } from './vdomInteropState'
import { adoptVdomOwnedEffect } from './vdomSlotOwner'

export class RenderEffect extends ReactiveEffect {
  i: VaporComponentInstance | null
  // Created lazily on first notify: most render effects are never
  // scheduled individually, so eagerly allocating the job closure at
  // creation time is pure overhead in list-mount hot paths. The constructor
  // still primes the field to keep every instance on one hidden class.
  job?: SchedulerJob
  updateJob?: SchedulerJob
  render: () => void
  // Creation order within the owning component.
  order: number

  constructor(render: () => void, noLifecycle = false) {
    super(noLifecycle ? render : undefined)
    this.render = render
    const instance = currentInstance as VaporComponentInstance | null
    // a vdom instance rendering vapor content owns the update job at order 0
    const vdomOwner =
      isInteropEnabled && instance && !instance.vapor ? instance : null
    if (vdomOwner && !vdomOwner.effectCount) vdomOwner.effectCount = 1
    this.order = instance ? instance.effectCount++ : 0
    if (__DEV__ && !__TEST__ && !this.subs && !isVaporComponent(instance)) {
      warn('renderEffect called without active EffectScope or Vapor instance.')
    }

    if (__DEV__ && instance && !noLifecycle) {
      this.onTrack = instance.rtc
        ? e => invokeArrayFns(instance.rtc!, e)
        : void 0
      this.onTrigger = instance.rtg
        ? e => invokeArrayFns(instance.rtg!, e)
        : void 0
    }

    this.i = instance
    this.job = undefined

    // Allow self re-queue when render/hook logic mutates reactive state.
    // Safe in Vapor because updates are always async via queueJob(), and
    // isUpdating prevents duplicate bu/u hooks on re-entry.
    this.flags |= EffectFlags.ALLOW_RECURSE

    // a registered vdom owner (one that renders vapor slots) re-renders for
    // the effects it owns; last, so their own fields extend the shared shape
    if (vdomOwner) adoptVdomOwnedEffect(this, vdomOwner, noLifecycle)
  }

  createJob(): SchedulerJob {
    const job: SchedulerJob = () => {
      // The job may already be queued when its owning scope is paused.
      if (!(this.flags & EffectFlags.PAUSED) && this.dirty) {
        // A pending KeepAlive async root defers updates along its root chain.
        const deferred =
          __FEATURE_SUSPENSE__ &&
          isSuspenseEnabled &&
          this.i &&
          this.i.deferredKeepAliveUpdates
        if (deferred) {
          if (isDeferredKeepAliveStateLive(deferred)) {
            deferred.effects.push(job)
            return
          }
          // The pending root can no longer resolve through this state
          // (unmounted early or superseded suspense cycle) - drop the stale
          // state and replay its buffered updates together with this job in
          // scheduler order (this job re-enters with the state cleared).
          settleDeferredKeepAliveUpdates(deferred, job)
          return
        }
        // Input effects also update the owner's options through child props,
        // without invoking its public lifecycle hooks. In the normal post-flush
        // queue, apply selection before public hooks, including pending ones.
        if (this.i && this.i.selectUpdates) {
          queueSelectUpdates(this.i)
        }
        this.run()
      }
    }
    if (this.i) job.i = this.i
    job.flags! |= SchedulerJobFlags.ALLOW_RECURSE
    return (this.job = job)
  }

  fn(): void {
    const instance = this.i
    const scope = this.subs ? (this.subs.sub as EffectScope) : undefined
    // renderEffect is always called after user has registered all hooks
    const hasUpdateHooks = instance && (instance.bu || instance.u)
    if (__DEV__ && instance) {
      startMeasure(instance, `renderEffect`)
    }
    const prev = setCurrentInstance(instance, scope)
    try {
      if (hasUpdateHooks && instance.isMounted && !instance.isUpdating) {
        // avoid recurse update until updateJob flushed
        instance.isUpdating = true
        try {
          instance.bu && invokeArrayFns(instance.bu)
          this.render()
        } catch (err) {
          instance.isUpdating = false
          throw err
        }
        let updateJob = this.updateJob
        if (!updateJob) {
          updateJob = this.updateJob = () => {
            instance.isUpdating = false
            instance.u && invokeArrayFns(instance.u)
          }
        }
        queuePostRenderEffect(updateJob, undefined, instance.suspense)
      } else {
        this.render()
      }
    } finally {
      restoreCurrentInstance(prev)
      if (__DEV__ && instance) {
        endMeasure(instance, `renderEffect`)
      }
    }
  }

  notify(): void {
    const flags = this.flags
    if (!(flags & EffectFlags.PAUSED)) {
      queueJob(
        this.job || this.createJob(),
        this.i ? this.i.uid : undefined,
        false,
        this.order,
      )
    }
  }
}

export function renderEffect(fn: () => void, noLifecycle = false): void {
  if (inOnce) return fn()

  const effect = new RenderEffect(fn, noLifecycle)
  effect.run()
}

/**
 * Re-applies a select's selection after the current owner's effects update
 * its options. A vdom owner rendering vapor content runs it from its updated
 * hooks instead. Returns the registered callback.
 */
export function registerSelectUpdate(update: () => void): () => void {
  const instance = currentInstance as VaporComponentInstance
  if (isInteropEnabled && !instance.vapor) {
    // vdom queues a copy of its updated hooks, which can outlive the select
    let active = true
    const hook = () => {
      if (active) update()
    }
    const hooks = instance.u || (instance.u = [])
    hooks.unshift(hook)
    onScopeDispose(() => {
      active = false
      remove(hooks, hook)
    })
    return hook
  } else {
    const updates =
      instance.selectUpdates || (instance.selectUpdates = new Set())
    updates.add(update)
    onScopeDispose(() => updates.delete(update))
    return update
  }
}

export function queueSelectUpdates(instance: VaporComponentInstance): void {
  if (instance.selectUpdates!.size) {
    queuePostRenderEffect(
      instance.selectUpdateJob ||
        (instance.selectUpdateJob = () => {
          for (const update of instance.selectUpdates!) update()
        }),
      instance.uid,
      instance.suspense,
    )
  }
}
