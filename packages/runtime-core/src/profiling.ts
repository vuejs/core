/* eslint-disable no-restricted-globals */
import {
  type ComponentInternalInstance,
  formatComponentName,
} from './component'
import { devtoolsPerfEnd, devtoolsPerfStart } from './devtools'

const perf = typeof window !== 'undefined' && window.performance
const timer = perf ? () => perf.now() : Date.now

export function startMeasure(
  instance: ComponentInternalInstance,
  type: string,
): void {
  if (instance.appContext.config.performance && perf) {
    perf.mark(`vue-${type}-${instance.uid}`)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfStart(instance, type, timer())
  }
}

export function endMeasure(
  instance: ComponentInternalInstance,
  type: string,
): void {
  if (instance.appContext.config.performance && perf) {
    const startTag = `vue-${type}-${instance.uid}`
    const endTag = startTag + `:end`
    perf.mark(endTag)
    perf.measure(
      `<${formatComponentName(instance, instance.type)}> ${type}`,
      startTag,
      endTag,
    )
    perf.clearMarks(startTag)
    perf.clearMarks(endTag)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfEnd(instance, type, timer())
  }
}
