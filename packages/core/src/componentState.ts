import { EMPTY_OBJ } from './utils'
import { ComponentInstance } from './component'
import { observable } from '@vue/observer'

export function initializeState(instance: ComponentInstance) {
  if (instance.data) {
    instance._rawData = instance.data()
    instance.$data = observable(instance._rawData)
  } else {
    instance.$data = EMPTY_OBJ
  }
}
