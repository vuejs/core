import { EffectFlags, type EffectScope, ReactiveEffect } from '@vue/reactivity'
import {
  type SchedulerJob,
  SchedulerJobFlags,
  currentInstance,
  endMeasure,
  queueJob,
  queuePostFlushCb,
  setCurrentInstance,
  startMeasure,
  warn,
} from '@vue/runtime-dom'
import { type VaporComponentInstance, isVaporComponent } from './component'
import { inOnceSlot } from './componentSlots'
import { invokeArrayFns } from '@vue/shared'

export class RenderEffect extends ReactiveEffect {
  i: VaporComponentInstance | null
  job: SchedulerJob
  updateJob?: SchedulerJob
  render: () => void

  constructor(render: () => void, noLifecycle = false) {
    super(noLifecycle ? render : undefined)
    this.render = render
    const instance = currentInstance as VaporComponentInstance | null
    if (__DEV__ && !__TEST__ && !this.subs && !isVaporComponent(instance)) {
      warn('renderEffect called without active EffectScope or Vapor instance.')
    }

    const job: SchedulerJob = () => {
      if (this.dirty) {
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
        queuePostFlushCb(updateJob)
      } else {
        this.render()
      }
    } finally {
      setCurrentInstance(...prev)
      if (__DEV__ && instance) {
        endMeasure(instance, `renderEffect`)
      }
    }
  }

  notify(): void {
    const flags = this.flags
    if (!(flags & EffectFlags.PAUSED)) {
      queueJob(this.job, this.i ? this.i.uid : undefined)
    }
  }
}

export function renderEffect(fn: () => void, noLifecycle = false): void {
  // in once slot, just run the function directly
  if (inOnceSlot) return fn()

  const effect = new RenderEffect(fn, noLifecycle)
  effect.run()
}
