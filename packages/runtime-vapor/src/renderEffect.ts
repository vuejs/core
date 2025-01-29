import { ReactiveEffect, getCurrentScope } from '@vue/reactivity'
import {
  type SchedulerJob,
  currentInstance,
  queueJob,
  queuePostFlushCb,
  simpleSetCurrentInstance,
  startMeasure,
  warn,
} from '@vue/runtime-dom'
import { type VaporComponentInstance, isVaporComponent } from './component'
import { invokeArrayFns } from '@vue/shared'

export function renderEffect(fn: () => void, noLifecycle = false): void {
  const instance = currentInstance as VaporComponentInstance | null
  const scope = getCurrentScope()
  if (__DEV__ && !__TEST__ && !isVaporComponent(instance)) {
    warn('renderEffect called without active vapor instance.')
  }

  // renderEffect is always called after user has registered all hooks
  const hasUpdateHooks = instance && (instance.bu || instance.u)
  const renderEffectFn = noLifecycle
    ? fn
    : () => {
        if (__DEV__ && instance) {
          startMeasure(instance, `renderEffect`)
        }
        const prev = currentInstance
        simpleSetCurrentInstance(instance)
        if (scope) scope.on()
        if (hasUpdateHooks && instance.isMounted && !instance.isUpdating) {
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
        if (scope) scope.off()
        simpleSetCurrentInstance(prev, instance)
        if (__DEV__ && instance) {
          startMeasure(instance, `renderEffect`)
        }
      }

  const effect = new ReactiveEffect(renderEffectFn)
  const job: SchedulerJob = () => effect.dirty && effect.run()

  if (instance) {
    if (__DEV__) {
      effect.onTrack = instance.rtc
        ? e => invokeArrayFns(instance.rtc!, e)
        : void 0
      effect.onTrigger = instance.rtg
        ? e => invokeArrayFns(instance.rtg!, e)
        : void 0
    }
    job.i = instance
    job.id = instance.uid
  }

  effect.scheduler = () => queueJob(job)
  effect.run()

  // TODO recurse handling
  // TODO measure
}
