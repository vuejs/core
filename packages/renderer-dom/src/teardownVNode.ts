import { VNode } from '@vue/core'
import { handleDelegatedEvent } from './modules/events'
import { onRE } from '@vue/shared'

export function teardownVNode(vnode: VNode) {
  const { el, data } = vnode
  if (data != null) {
    for (const key in data) {
      if (onRE.test(key)) {
        handleDelegatedEvent(el, key.toLowerCase().slice(2), null)
      }
    }
  }
}
