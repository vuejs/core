import {
  getCurrentScope,
  onEffectCleanup,
  onScopeDispose,
} from '@vue/reactivity'
import {
  MetadataKind,
  getMetadata,
  recordEventMetadata,
} from '../componentMetadata'
import { withKeys, withModifiers } from '@vue/runtime-dom'
import { queuePostFlushCb } from '../scheduler'

export function addEventListener(
  el: Element,
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

export function on(
  el: Element,
  event: string,
  handlerGetter: () => undefined | ((...args: any[]) => any),
  options: AddEventListenerOptions &
    ModifierOptions & { effect?: boolean } = {},
) {
  const handler: DelegatedHandler = eventHandler(handlerGetter, options)
  let cleanupEvent: (() => void) | undefined
  queuePostFlushCb(() => {
    cleanupEvent = addEventListener(el, event, handler, options)
  })

  if (options.effect) {
    onEffectCleanup(cleanup)
  } else if (getCurrentScope()) {
    onScopeDispose(cleanup)
  }

  function cleanup() {
    cleanupEvent && cleanupEvent()
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
  options: ModifierOptions = {},
) {
  const handler: DelegatedHandler = eventHandler(handlerGetter, options)
  handler.delegate = true
  recordEventMetadata(el, event, handler)
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
    const handlers = getMetadata(node)[MetadataKind.event][e.type]
    if (handlers) {
      for (const handler of handlers) {
        if (handler.delegate && !node.disabled) {
          handler(e)
          if (e.cancelBubble) return
        }
      }
    }
    node =
      node.host && node.host !== node && node.host instanceof Node
        ? node.host
        : node.parentNode
  }
}

export function setDynamicEvents(
  el: HTMLElement,
  events: Record<string, (...args: any[]) => any>,
) {
  for (const [event, eventHandler] of Object.entries(events)) {
    on(el, event, () => eventHandler, { effect: true })
  }
}
