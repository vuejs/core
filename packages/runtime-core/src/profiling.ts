/* eslint-disable no-restricted-globals */
import { type GenericComponentInstance, formatComponentName } from './component'
import { devtoolsPerfEnd, devtoolsPerfStart } from './devtools'

let supported: boolean
let perf: Performance

/**
 * @internal
 */
export function startMeasure(
  instance: GenericComponentInstance,
  type: string,
): void {
  if (instance.appContext.config.performance && isSupported()) {
    perf.mark(`vue-${type}-${instance.uid}`)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfStart(instance, type, isSupported() ? perf.now() : Date.now())
  }
}

/**
 * @internal
 */
export function endMeasure(
  instance: GenericComponentInstance,
  type: string,
): void {
  if (instance.appContext.config.performance && isSupported()) {
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
    devtoolsPerfEnd(instance, type, isSupported() ? perf.now() : Date.now())
  }
}

function isSupported() {
  if (supported !== undefined) {
    return supported
  }
  if (typeof window !== 'undefined' && window.performance) {
    supported = true
    perf = window.performance
  } else {
    supported = false
  }
  return supported
}
