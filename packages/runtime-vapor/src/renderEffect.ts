import {
  type EffectScope,
  ReactiveEffect,
  getCurrentScope,
} from '@vue/reactivity'
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

class RenderEffect extends ReactiveEffect {
  i: VaporComponentInstance | null
  scope: EffectScope | undefined
  baseJob: SchedulerJob
  postJob: SchedulerJob

  constructor(public render: () => void) {
    super()
    const instance = currentInstance as VaporComponentInstance | null
    const scope = getCurrentScope()
    if (__DEV__ && !__TEST__ && !scope && !isVaporComponent(instance)) {
      warn('renderEffect called without active EffectScope or Vapor instance.')
    }

    this.baseJob = () => {
      if (this.dirty) {
        this.run()
      }
    }
    this.postJob = () => {
      instance!.isUpdating = false
      instance!.u && invokeArrayFns(instance!.u)
    }

    if (instance) {
      if (__DEV__) {
        this.onTrack = instance.rtc
          ? e => invokeArrayFns(instance.rtc!, e)
          : void 0
        this.onTrigger = instance.rtg
          ? e => invokeArrayFns(instance.rtg!, e)
          : void 0
      }
      this.baseJob.i = instance
      this.baseJob.id = instance.uid
    }

    this.i = instance
    this.scope = scope

    // TODO recurse handling
  }

  callback(): void {
    const instance = this.i!
    const scope = this.scope
    // renderEffect is always called after user has registered all hooks
    const hasUpdateHooks = instance && (instance.bu || instance.u)
    if (__DEV__ && instance) {
      startMeasure(instance, `renderEffect`)
    }
    const prev = currentInstance
    simpleSetCurrentInstance(instance)
    if (scope) scope.on()
    if (hasUpdateHooks && instance.isMounted && !instance.isUpdating) {
      instance.isUpdating = true
      instance.bu && invokeArrayFns(instance.bu)
      this.render()
      queuePostFlushCb(this.postJob)
    } else {
      this.render()
    }
    if (scope) scope.off()
    simpleSetCurrentInstance(prev, instance)
    if (__DEV__ && instance) {
      startMeasure(instance, `renderEffect`)
    }
  }

  scheduler(): void {
    queueJob(this.baseJob)
  }
}

class RenderEffect_NoLifecycle extends RenderEffect {
  constructor(render: () => void) {
    super(render)
  }

  callback() {
    this.render()
  }
}

export function renderEffect(fn: () => void, noLifecycle = false): void {
  if (noLifecycle) {
    new RenderEffect_NoLifecycle(fn).run()
  } else {
    new RenderEffect(fn).run()
  }
}
