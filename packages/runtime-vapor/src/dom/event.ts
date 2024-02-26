import {
  getCurrentEffect,
  getCurrentScope,
  onEffectCleanup,
  onScopeDispose,
} from '@vue/reactivity'
import { getMetadata, recordMetadata } from '../metadata'
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

interface ModifierOptions {
  modifiers?: string[]
  keys?: string[]
}

interface EventOptions extends AddEventListenerOptions, ModifierOptions {}

export function on(
  el: HTMLElement,
  event: string,
  handlerGetter: () => undefined | ((...args: any[]) => any),
  options: EventOptions = {},
) {
  const handler: DelegatedHandler = eventHandler(handlerGetter, options)
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

export type DelegatedHandler = {
  (...args: any[]): any
  delegate?: boolean
}

export function delegate(
  el: HTMLElement,
  event: string,
  handlerGetter: () => undefined | ((...args: any[]) => any),
  options: EventOptions = {},
) {
  const handler: DelegatedHandler = eventHandler(handlerGetter, options)
  handler.delegate = true
  recordMetadata(el, 'events', event, handler)
}

function eventHandler(
  getter: () => undefined | ((...args: any[]) => any),
  { modifiers, keys }: ModifierOptions = {},
) {
  return (...args: any[]) => {
    let handler = getter()
    if (!handler) return

    if (modifiers) handler = withModifiers(handler, modifiers)
    if (keys) handler = withKeys(handler, keys)
    handler && handler(...args)
  }
}

/**
 * Event delegation borrowed from solid
 */
const delegatedEvents = Object.create(null)

export const delegateEvents = (...names: string[]) => {
  for (const name of names) {
    if (!delegatedEvents[name]) {
      delegatedEvents[name] = true
      // eslint-disable-next-line no-restricted-globals
      document.addEventListener(name, delegatedEventHandler)
    }
  }
}

const delegatedEventHandler = (e: Event) => {
  let node = ((e.composedPath && e.composedPath()[0]) || e.target) as any
  if (e.target !== node) {
    Object.defineProperty(e, 'target', {
      configurable: true,
      value: node,
    })
  }
  Object.defineProperty(e, 'currentTarget', {
    configurable: true,
    get() {
      // eslint-disable-next-line no-restricted-globals
      return node || document
    },
  })
  while (node !== null) {
    const handler = getMetadata(node).events[e.type]
    if (handler && handler.delegate && !node.disabled) {
      handler(e)
      if (e.cancelBubble) return
    }
    node =
      node.host && node.host !== node && node.host instanceof Node
        ? node.host
        : node.parentNode
  }
}
