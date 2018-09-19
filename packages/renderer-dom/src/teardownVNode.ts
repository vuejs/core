import { VNode } from '@vue/core'
import { handleDelegatedEvent } from './modules/events'

export function teardownVNode(vnode: VNode) {
  const { el, data } = vnode
  if (data != null) {
    for (const key in data) {
      if (key.startsWith('on')) {
        handleDelegatedEvent(el, key.toLowerCase().slice(2), null)
      }
    }
  }
}
