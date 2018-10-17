import { VNode } from '@vue/core'
import { handleDelegatedEvent } from './modules/events'
import { isOn } from '@vue/shared'

export function teardownVNode(vnode: VNode) {
  const { el, data } = vnode
  if (data != null) {
    for (const key in data) {
      if (isOn(key)) {
        handleDelegatedEvent(el, key.slice(2).toLowerCase(), null)
      }
    }
  }
}
