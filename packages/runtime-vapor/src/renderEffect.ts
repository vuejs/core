import {
  EffectFlags,
  ReactiveEffect,
  type SchedulerJob,
  SchedulerJobFlags,
  getCurrentScope,
} from '@vue/reactivity'
import { invokeArrayFns } from '@vue/shared'
import {
  type ComponentInternalInstance,
  getCurrentInstance,
  setCurrentInstance,
} from './component'
import { queueJob, queuePostFlushCb } from './scheduler'
import { VaporErrorCodes, callWithAsyncErrorHandling } from './errorHandling'
import { invokeDirectiveHook } from './directives'

export function renderEffect(cb: () => void) {
  const instance = getCurrentInstance()
  const scope = getCurrentScope()
  let effect: ReactiveEffect

  const job: SchedulerJob = () => {
    if (!(effect.flags & EffectFlags.ACTIVE) || !effect.dirty) {
      return
    }

    if (instance?.isMounted && !instance.isUpdating) {
      instance.isUpdating = true

      const { bu, u, dirs } = instance
      // beforeUpdate hook
      if (bu) {
        invokeArrayFns(bu)
      }
      if (dirs) {
        invokeDirectiveHook(instance, 'beforeUpdate')
      }

      effect.run()

      queuePostFlushCb(() => {
        instance.isUpdating = false
        if (dirs) {
          invokeDirectiveHook(instance, 'updated')
        }
        // updated hook
        if (u) {
          queuePostFlushCb(u)
        }
      })
    } else {
      effect.run()
    }
  }

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
  }

  effect = new ReactiveEffect(() =>
    callWithAsyncErrorHandling(cb, instance, VaporErrorCodes.RENDER_FUNCTION),
  )

  effect.scheduler = () => {
    if (instance) job.id = instance.uid
    queueJob(job)
  }
  if (__DEV__) {
    effect.onTrack = instance?.rtc
      ? e => invokeArrayFns(instance.rtc!, e)
      : void 0
    effect.onTrigger = instance?.rtg
      ? e => invokeArrayFns(instance.rtg!, e)
      : void 0
  }
  effect.run()
}

export function firstEffect(
  instance: ComponentInternalInstance,
  fn: () => void,
) {
  const effect = new ReactiveEffect(fn)
  const job: SchedulerJob = () => effect.run()
  job.flags! |= SchedulerJobFlags.PRE
  job.id = instance.uid
  effect.scheduler = () => queueJob(job)
  effect.run()
}
