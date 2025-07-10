import { onEffectCleanup } from '@vue/reactivity'
import { isArray } from '@vue/shared'

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
  handler: (e: Event) => any,
  options: AddEventListenerOptions & { effect?: boolean } = {},
): void {
  addEventListener(el, event, handler, options)
  if (options.effect) {
    onEffectCleanup(() => {
      el.removeEventListener(event, handler, options)
    })
  }
}

export function delegate(
  el: any,
  event: string,
  handler: (e: Event) => any,
): void {
  const key = `$evt${event}`
  const existing = el[key]
  if (existing) {
    if (isArray(existing)) {
      existing.push(handler)
    } else {
      el[key] = [existing, handler]
    }
  } else {
    el[key] = handler
  }
}

type DelegatedHandler = {
  (...args: any[]): any
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
    const handlers = node[`$evt${e.type}`] as
      | DelegatedHandler
      | DelegatedHandler[]
    if (handlers) {
      if (isArray(handlers)) {
        for (const handler of handlers) {
          if (!node.disabled) {
            handler(e)
            if (e.cancelBubble) return
          }
        }
      } else {
        handlers(e)
        if (e.cancelBubble) return
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
    on(el, name, events[name], { effect: true })
  }
}
