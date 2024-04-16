import { isArray } from '@vue/shared'
import type { TestElement } from './nodeOps'

export function triggerEvent(
  el: TestElement,
  event: string,
  payload: any[] = [],
) {
  const { eventListeners } = el
  if (eventListeners) {
    const listener = eventListeners[event]
    if (listener) {
      if (isArray(listener)) {
        for (let i = 0; i < listener.length; i++) {
          listener[i](...payload)
        }
      } else {
        listener(...payload)
      }
    }
  }
}
