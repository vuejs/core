import { getCurrentEffect, onEffectCleanup } from '@vue/reactivity'

export function on(
  el: HTMLElement,
  event: string,
  handler: () => any,
  options?: AddEventListenerOptions,
) {
  el.addEventListener(event, handler, options)
  if (getCurrentEffect()) {
    onEffectCleanup(() => el.removeEventListener(event, handler, options))
  }
}
