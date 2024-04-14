import {
  EffectFlags,
  ReactiveEffect,
  type SchedulerJob,
  SchedulerJobFlags,
} from '@vue/reactivity'
import { invokeArrayFns } from '@vue/shared'
import {
  type ComponentInternalInstance,
  getCurrentInstance,
  setCurrentInstance,
} from './component'
import { queueJob, queuePostRenderEffect } from './scheduler'
import { VaporErrorCodes, callWithAsyncErrorHandling } from './errorHandling'
import { invokeDirectiveHook } from './directives'

export function renderEffect(cb: () => void) {
  const instance = getCurrentInstance()

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

      queuePostRenderEffect(() => {
        instance.isUpdating = false
        if (dirs) {
          invokeDirectiveHook(instance, 'updated')
        }
        // updated hook
        if (u) {
          queuePostRenderEffect(u)
        }
      })
    } else {
      effect.run()
    }
  }

  effect = new ReactiveEffect(() => {
    const reset = instance && setCurrentInstance(instance)
    callWithAsyncErrorHandling(cb, instance, VaporErrorCodes.RENDER_FUNCTION)
    reset?.()
  })

  effect.scheduler = () => {
    if (instance) job.id = instance.uid
    queueJob(job)
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
