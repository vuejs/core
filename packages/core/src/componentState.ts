import { EMPTY_OBJ } from './utils'
import { MountedComponent } from './component'
import { observable } from '@vue/observer'

export function initializeState(instance: MountedComponent) {
  if (instance.data) {
    instance._rawData = instance.data()
    instance.$data = observable(instance._rawData)
  } else {
    instance.$data = EMPTY_OBJ
  }
}
