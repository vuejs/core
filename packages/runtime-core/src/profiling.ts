import { ComponentInternalInstance, formatComponentName } from './component'
import { devtoolsPerfEnd, devtoolsPerfStart } from './devtools'

let supported: boolean
let perf: any

export function startMeasure(
  instance: ComponentInternalInstance,
  type: string
) {
  if (instance.appContext.config.performance && isSupported()) {
    perf.mark(`vue-${type}-${instance.uid}`)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfStart(instance, type, supported ? perf.now() : Date.now())
  }
}

export function endMeasure(instance: ComponentInternalInstance, type: string) {
  if (instance.appContext.config.performance && isSupported()) {
    const startTag = `vue-${type}-${instance.uid}`
    const endTag = startTag + `:end`
    perf.mark(endTag)
    perf.measure(
      `<${formatComponentName(instance, instance.type)}> ${type}`,
      startTag,
      endTag
    )
    perf.clearMarks(startTag)
    perf.clearMarks(endTag)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfEnd(instance, type, supported ? perf.now() : Date.now())
  }
}

function isSupported() {
  if (supported !== undefined) {
    return supported
  }
  /* eslint-disable no-restricted-globals */
  if (typeof window !== 'undefined' && window.performance) {
    supported = true
    perf = window.performance
  } else {
    supported = false
  }
  /* eslint-enable no-restricted-globals */
  return supported
}
