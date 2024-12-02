import {
  EffectScope,
  ReactiveEffect,
  pauseTracking,
  proxyRefs,
  resetTracking,
} from '@vue/reactivity'
import {
  type Component,
  type ComponentInternalInstance,
  createSetupContext,
} from './component'
import { EMPTY_OBJ, isFunction } from '@vue/shared'
import { type SchedulerJob, queueJob } from '../../runtime-core/src/scheduler'

export function createComponentSimple(component: any, rawProps?: any): any {
  const instance = new ComponentInstance(
    component,
    rawProps,
  ) as any as ComponentInternalInstance
  pauseTracking()
  let prevInstance = currentInstance
  currentInstance = instance
  instance.scope.on()
  const setupFn = isFunction(component) ? component : component.setup
  const setupContext = setupFn.length > 1 ? createSetupContext(instance) : null
  const node = setupFn(
    // TODO __DEV__ ? shallowReadonly(props) :
    instance.props,
    setupContext,
  )
  instance.scope.off()
  currentInstance = prevInstance
  resetTracking()
  node.__vue__ = instance
  return node
}

let uid = 0
let currentInstance: ComponentInstance | null = null

export class ComponentInstance {
  type: any
  uid: number = uid++
  scope: EffectScope = new EffectScope(true)
  props: any
  constructor(comp: Component, rawProps: any) {
    this.type = comp
    // init props
    this.props = rawProps ? proxyRefs(rawProps) : EMPTY_OBJ
    // TODO init slots
  }
}

export function renderEffectSimple(fn: () => void): void {
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
