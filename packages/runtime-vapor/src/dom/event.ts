import {
  getCurrentEffect,
  getCurrentScope,
  onEffectCleanup,
  onScopeDispose,
} from '@vue/reactivity'
import { recordMetadata } from '../metadata'
import { withKeys, withModifiers } from '@vue/runtime-dom'

export function addEventListener(
  el: HTMLElement,
  event: string,
  handler: (...args: any) => any,
  options?: AddEventListenerOptions,
) {
  el.addEventListener(event, handler, options)
  return () => el.removeEventListener(event, handler, options)
}

export function on(
  el: HTMLElement,
  event: string,
  handlerGetter: () => undefined | ((...args: any[]) => any),
  options?: AddEventListenerOptions,
  { modifiers, keys }: { modifiers?: string[]; keys?: string[] } = {},
) {
  const handler = (...args: any[]) => {
    let handler = handlerGetter()
    if (!handler) return

    if (modifiers) {
      handler = withModifiers(handler, modifiers)
    }
    if (keys) {
      handler = withKeys(handler, keys)
    }
    handler && handler(...args)
  }
  recordMetadata(el, 'events', event, handler)
  const cleanup = addEventListener(el, event, handler, options)

  const scope = getCurrentScope()
  const effect = getCurrentEffect()

  if (effect && effect.scope === scope) {
    onEffectCleanup(cleanup)
  } else if (scope) {
    onScopeDispose(cleanup)
  }
}
