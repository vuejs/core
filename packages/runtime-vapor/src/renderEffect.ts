import { EffectFlags, type EffectScope, ReactiveEffect } from '@vue/reactivity'
import {
  type GenericComponentInstance,
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
import { inOnceSlot } from './componentSlots'
import { invokeArrayFns } from '@vue/shared'
import { isSuspenseEnabled } from './suspense'
import { isKeepAliveEnabled } from './keepAlive'

export class RenderEffect extends ReactiveEffect {
  i: VaporComponentInstance | null
  job: SchedulerJob
  updateJob?: SchedulerJob
  render: () => void
  // Creation order within the owning component.
  order: number

  constructor(render: () => void, noLifecycle = false) {
    super(noLifecycle ? render : undefined)
    this.render = render
    const instance = currentInstance as VaporComponentInstance | null
    this.order = instance ? instance.effectCount++ : 0
    if (__DEV__ && !__TEST__ && !this.subs && !isVaporComponent(instance)) {
      warn('renderEffect called without active EffectScope or Vapor instance.')
    }

    const job: SchedulerJob = () => {
      if (this.dirty) {
        // A pending KeepAlive async root defers updates along its root chain.
        const deferred =
          __FEATURE_SUSPENSE__ &&
          isSuspenseEnabled &&
          this.i &&
          this.i.deferredKeepAliveUpdates
        if (deferred) {
          if (isDeferredKeepAliveStateLive(deferred)) {
            deferred.effects.push(this.job)
            return
          }
          // The pending root can no longer resolve through this state
          // (unmounted early or superseded suspense cycle) - drop the stale
          // state and replay its buffered updates together with this job in
          // scheduler order (this job re-enters with the state cleared).
          settleDeferredKeepAliveUpdates(deferred, this.job)
          return
        }

        const keepAliveRoot =
          isKeepAliveEnabled && this.i && findPausedKeepAliveRoot(this.i)
        if (keepAliveRoot) {
          this.pause()
          ;(keepAliveRoot.deferredKeepAliveEffects ||= new Set()).add(this)
          return
        }

        this.run()
      }
    }

    if (instance) {
      if (__DEV__ && !noLifecycle) {
        this.onTrack = instance.rtc
          ? e => invokeArrayFns(instance.rtc!, e)
          : void 0
        this.onTrigger = instance.rtg
          ? e => invokeArrayFns(instance.rtg!, e)
          : void 0
      }

      // register effect for HMR rerender cleanup
      if (__DEV__) {
        ;(instance.renderEffects ||= []).push(this)
      }
      job.i = instance
    }

    this.job = job
    this.i = instance

    // Allow self re-queue when render/hook logic mutates reactive state.
    // Safe in Vapor because updates are always async via queueJob(), and
    // isUpdating prevents duplicate bu/u hooks on re-entry.
    this.flags |= EffectFlags.ALLOW_RECURSE
    this.job.flags! |= SchedulerJobFlags.ALLOW_RECURSE
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
      queueJob(this.job, this.i ? this.i.uid : undefined, false, this.order)
    }
  }
}

export function renderEffect(fn: () => void, noLifecycle = false): void {
  // in once slot, just run the function directly
  if (inOnceSlot) return fn()

  const effect = new RenderEffect(fn, noLifecycle)
  effect.run()
}

function findPausedKeepAliveRoot(
  instance: VaporComponentInstance,
): VaporComponentInstance | undefined {
  let current: GenericComponentInstance | null = instance
  while (current) {
    if (isVaporComponent(current) && current.keepAliveUpdatePaused) {
      return current
    }
    current = current.parent
  }
}
