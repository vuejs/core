import { ReactiveEffect } from '@vue/reactivity'
import {
  type SchedulerJob,
  currentInstance,
  queueJob,
  queuePostFlushCb,
  setCurrentInstance,
  warn,
} from '@vue/runtime-dom'
import { type VaporComponentInstance, isVaporComponent } from './component'
import { invokeArrayFns } from '@vue/shared'

export function renderEffect(fn: () => void, noLifecycle = false): void {
  const instance = currentInstance as VaporComponentInstance
  if (__DEV__ && !isVaporComponent(instance)) {
    warn('renderEffect called without active vapor instance.')
  }

  const effect = new ReactiveEffect(
    noLifecycle
      ? fn
      : () => {
          const reset = setCurrentInstance(instance)
          const { isMounted, isUpdating, bu, u } = instance
          // before update
          if (isMounted && !isUpdating && (bu || u)) {
            instance.isUpdating = true
            bu && invokeArrayFns(bu)
            fn()
            queuePostFlushCb(() => {
              instance.isUpdating = false
              u && invokeArrayFns(u)
            })
          } else {
            fn()
          }
          reset()
        },
  )

  const job: SchedulerJob = effect.runIfDirty.bind(effect)
  job.i = instance
  job.id = instance.uid
  effect.scheduler = () => queueJob(job)
  effect.run()

  // TODO lifecycle
  // TODO recurse handling
  // TODO measure
}
