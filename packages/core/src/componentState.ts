import { ComponentInstance } from './component'
import { observable } from '@vue/observer'

const internalRE = /^_|^\$/

export function initializeState(instance: ComponentInstance) {
  if (instance.data) {
    instance._rawData = instance.data()
  } else {
    const keys = Object.keys(instance)
    const data = (instance._rawData = {} as any)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (!internalRE.test(key)) {
        data[key] = (instance as any)[key]
      }
    }
  }
  instance.$data = observable(instance._rawData || {})
}
