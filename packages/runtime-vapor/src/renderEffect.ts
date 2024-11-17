import { EffectFlags, ReactiveEffect, getCurrentScope } from '@vue/reactivity'
import { invokeArrayFns } from '@vue/shared'
import {
  type ComponentInternalInstance,
  getCurrentInstance,
  setCurrentInstance,
} from './component'
import {
  type SchedulerJob,
  VaporSchedulerJobFlags,
  queueJob,
  queuePostFlushCb,
} from './scheduler'
import { VaporErrorCodes, callWithAsyncErrorHandling } from './errorHandling'

export function renderEffect(cb: () => void): void {
  const instance = getCurrentInstance()
  const scope = getCurrentScope()

  if (scope) {
    const baseCb = cb
    cb = () => scope.run(baseCb)
  }

  if (instance) {
    const baseCb = cb
    cb = () => {
      const reset = setCurrentInstance(instance)
      baseCb()
      reset()
    }
    job.id = instance.uid
  }

  const effect = new ReactiveEffect(() =>
    callWithAsyncErrorHandling(cb, instance, VaporErrorCodes.RENDER_FUNCTION),
  )

  effect.scheduler = () => queueJob(job)
  if (__DEV__ && instance) {
    effect.onTrack = instance.rtc
      ? e => invokeArrayFns(instance.rtc!, e)
      : void 0
    effect.onTrigger = instance.rtg
      ? e => invokeArrayFns(instance.rtg!, e)
      : void 0
  }
  effect.run()

  function job() {
    if (!(effect.flags & EffectFlags.ACTIVE) || !effect.dirty) {
      return
    }

    const reset = instance && setCurrentInstance(instance)

    if (instance && instance.isMounted && !instance.isUpdating) {
      instance.isUpdating = true

      const { bu, u } = instance
      // beforeUpdate hook
      if (bu) {
        invokeArrayFns(bu)
      }

      effect.run()

      queuePostFlushCb(() => {
        instance.isUpdating = false
        const reset = setCurrentInstance(instance)
        // updated hook
        if (u) {
          queuePostFlushCb(u)
        }
        reset()
      })
    } else {
      effect.run()
    }

    reset && reset()
  }
}

export function firstEffect(
  instance: ComponentInternalInstance,
  fn: () => void,
): void {
  const effect = new ReactiveEffect(fn)
  const job: SchedulerJob = () => effect.run()
  job.flags! |= VaporSchedulerJobFlags.PRE
  job.id = instance.uid
  effect.scheduler = () => queueJob(job)
  effect.run()
}
