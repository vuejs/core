import {
  getCurrentScope,
  onEffectCleanup,
  onScopeDispose,
} from '@vue/reactivity'
import { queuePostFlushCb } from '@vue/runtime-dom'
import { remove } from '@vue/shared'

export function addEventListener(
  el: Element,
  event: string,
  handler: (...args: any) => any,
  options?: AddEventListenerOptions,
) {
  el.addEventListener(event, handler, options)
  return (): void => el.removeEventListener(event, handler, options)
}

export function on(
  el: Element,
  event: string,
  handlerGetter: () => undefined | ((...args: any[]) => any),
  options: AddEventListenerOptions & { effect?: boolean } = {},
): void {
  const handler: DelegatedHandler = eventHandler(handlerGetter)
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
  el: any,
  event: string,
  handlerGetter: () => undefined | ((...args: any[]) => any),
): void {
  const handler: DelegatedHandler = eventHandler(handlerGetter)
  handler.delegate = true

  const cacheKey = `$evt${event}`
  const handlers: DelegatedHandler[] = el[cacheKey] || (el[cacheKey] = [])
  handlers.push(handler)
  onScopeDispose(() => remove(handlers, handler))
}

function eventHandler(getter: () => undefined | ((...args: any[]) => any)) {
  return (...args: any[]) => {
    let handler = getter()
    if (!handler) return

    handler && handler(...args)
  }
}

/**
 * Event delegation borrowed from solid
 */
const delegatedEvents = Object.create(null)

export const delegateEvents = (...names: string[]): void => {
  for (const name of names) {
    if (!delegatedEvents[name]) {
      delegatedEvents[name] = true
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
      return node || document
    },
  })
  while (node !== null) {
    const handlers = node[`$evt${e.type}`] as DelegatedHandler[]
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
): void {
  for (const name in events) {
    on(el, name, () => events[name], { effect: true })
  }
}
