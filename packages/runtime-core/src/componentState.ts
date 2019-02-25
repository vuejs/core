import { ComponentInstance } from './component'
import { observable } from '@vue/observer'
import { isReservedKey } from '@vue/shared'
import { warn } from './warning'

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
  const props = instance.$options.props
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (!isReservedKey(key)) {
      // it's possible for a prop to be present here when it's declared with
      // decorators and has a default value.
      if (props && props.hasOwnProperty(key)) {
        __DEV__ &&
          warn(
            `Class property "${key}" is declared as a prop but also has an initializer. ` +
              `If you are trying to provide a default value for the prop, use the ` +
              `prop's "default" option instead.`
          )
      } else {
        data[key] = (instance as any)[key]
      }
    }
  }
  return data
}
