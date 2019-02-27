import { ComponentInstance } from './component'
import { observable } from '@vue/observer'
import { isReservedKey } from './componentOptions'

export function initializeState(
  instance: ComponentInstance,
  shouldExtractInitializers: boolean
) {
  const { data } = instance.$options
  const rawData = (instance._rawData = (data ? data.call(instance) : {}) as any)
  if (shouldExtractInitializers) {
    extractInitializers(instance, rawData)
  }
  instance.$data = observable(rawData || {})
}

// extract properties initialized in a component's constructor
export function extractInitializers(
  instance: ComponentInstance,
  data: any = {}
): any {
  const keys = Object.keys(instance)
  const props = instance.$props
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (!isReservedKey(key) && !props.hasOwnProperty(key)) {
      data[key] = (instance as any)[key]
    }
  }
  return data
}
