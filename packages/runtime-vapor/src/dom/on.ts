import { getCurrentEffect, onEffectCleanup } from '@vue/reactivity'
import { recordPropMetadata } from './patchProp'
import { toHandlerKey } from '@vue/shared'

export function on(
  el: HTMLElement,
  event: string,
  handler: (...args: any) => any,
  options?: AddEventListenerOptions,
) {
  recordPropMetadata(el, toHandlerKey(event), handler)
  el.addEventListener(event, handler, options)
  if (getCurrentEffect()) {
    onEffectCleanup(() => el.removeEventListener(event, handler, options))
  }
}
