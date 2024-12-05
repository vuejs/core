import { ReactiveEffect } from '@vue/reactivity'
import { type SchedulerJob, currentInstance, queueJob } from '@vue/runtime-dom'

export function renderEffect(fn: () => void): void {
  const updateFn = () => {
    fn()
  }
  const effect = new ReactiveEffect(updateFn)
  const job: SchedulerJob = effect.runIfDirty.bind(effect)
  job.i = currentInstance as any
  job.id = currentInstance!.uid
  effect.scheduler = () => queueJob(job)
  effect.run()

  // TODO lifecycle
  // TODO recurse handling
  // TODO measure
}
