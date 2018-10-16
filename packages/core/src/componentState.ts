import { ComponentInstance } from './component'
import { observable } from '@vue/observer'

const internalRE = /^_|^\$/

export function initializeState(instance: ComponentInstance) {
  const { data } = instance.$options
  const rawData = (instance._rawData = (data ? data.call(instance) : {}) as any)
  const keys = Object.keys(instance)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (!internalRE.test(key)) {
      rawData[key] = (instance as any)[key]
    }
  }
  instance.$data = observable(rawData || {})
}
