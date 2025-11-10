/* eslint-disable no-restricted-globals */
import { type GenericComponentInstance, formatComponentName } from './component'
import { devtoolsPerfEnd, devtoolsPerfStart } from './devtools'

let supported: boolean
let perf: Performance

// To avoid the overhead of repeatedly calling Date.now(), we cache
// and use the same timestamp for all event listeners attached in the same tick.
let cachedNow: number = 0
const p = /*@__PURE__*/ Promise.resolve()
const getNow = () =>
  cachedNow ||
  (p.then(() => (cachedNow = 0)),
  (cachedNow = isSupported() ? perf.now() : Date.now()))

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
    devtoolsPerfStart(instance, type, getNow())
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
    const measureName = `<${formatComponentName(instance, instance.type)}> ${type}`
    perf.mark(endTag)
    perf.measure(measureName, startTag, endTag)
    perf.clearMeasures(measureName)
    perf.clearMarks(startTag)
    perf.clearMarks(endTag)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfEnd(instance, type, getNow())
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
