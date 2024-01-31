import {
  getCurrentEffect,
  getCurrentScope,
  onEffectCleanup,
  onScopeDispose,
} from '@vue/reactivity'
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

  const scope = getCurrentScope()
  const effect = getCurrentEffect()

  const cleanup = () => el.removeEventListener(event, handler, options)
  if (effect && effect.scope === scope) {
    onEffectCleanup(cleanup)
  } else if (scope) {
    onScopeDispose(cleanup)
  }
}
