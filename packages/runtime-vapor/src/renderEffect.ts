import { ReactiveEffect } from '@vue/reactivity'
import {
  type SchedulerJob,
  currentInstance,
  queueJob,
  queuePostFlushCb,
  simpleSetCurrentInstance,
  warn,
} from '@vue/runtime-dom'
import { type VaporComponentInstance, isVaporComponent } from './component'
import { invokeArrayFns } from '@vue/shared'

export function renderEffect(fn: () => void, noLifecycle = false): void {
  const instance = currentInstance as VaporComponentInstance
  if (__DEV__ && !isVaporComponent(instance)) {
    warn('renderEffect called without active vapor instance.')
  }

  const renderEffectFn = noLifecycle
    ? fn
    : () => {
        const prev = currentInstance
        simpleSetCurrentInstance(instance)
        if (
          instance.isMounted &&
          !instance.isUpdating &&
          (instance.bu || instance.u)
        ) {
          instance.isUpdating = true
          instance.bu && invokeArrayFns(instance.bu)
          fn()
          queuePostFlushCb(() => {
            instance.isUpdating = false
            instance.u && invokeArrayFns(instance.u)
          })
        } else {
          fn()
        }
        simpleSetCurrentInstance(prev, instance)
      }

  const effect = new ReactiveEffect(renderEffectFn)
  const job: SchedulerJob = effect.runIfDirty.bind(effect)
  job.i = instance
  job.id = instance.uid
  effect.scheduler = () => queueJob(job)
  effect.run()

  // TODO lifecycle
  // TODO recurse handling
  // TODO measure
}
