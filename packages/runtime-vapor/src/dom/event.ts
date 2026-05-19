import { onEffectCleanup } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import {
  ErrorCodes,
  callWithAsyncErrorHandling,
  currentInstance,
  withKeys as withDomKeys,
  withModifiers as withDomModifiers,
} from '@vue/runtime-dom'

type EventHandler = (...args: any[]) => any
type EventHandlerValue = EventHandler | EventHandler[]
type MaybeEventHandlerValue = EventHandlerValue | null | undefined

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
  handler: EventHandlerValue,
  options: AddEventListenerOptions = {},
): void {
  if (isArray(handler)) {
    handler.forEach(fn => on(el, event, fn, options))
  } else {
    if (!handler) return
    addEventListener(el, event, createInvoker(handler), options)
  }
}

export function onBinding(
  el: Element,
  event: string,
  handler: EventHandlerValue,
  options: AddEventListenerOptions = {},
): void {
  if (isArray(handler)) {
    handler.forEach(fn => onBinding(el, event, fn, options))
  } else {
    if (!handler) return
    const cleanup = addEventListener(el, event, createInvoker(handler), options)
    onEffectCleanup(cleanup)
  }
}

export function delegate(el: any, event: string, handler: EventHandler): void {
  const key = `$evt${event}`
  const existing = el[key]
  const invoker = createInvoker(handler)
  if (existing) {
    if (isArray(existing)) {
      existing.push(invoker)
    } else {
      el[key] = [existing, invoker]
    }
  } else {
    el[key] = invoker
  }
}

type DelegatedHandler = EventHandler

/**
 * Event delegation borrowed from solid
 */
const delegatedEvents = /*@__PURE__*/ Object.create(null)

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
  events: Record<string, EventHandlerValue>,
): void {
  for (const name in events) {
    onBinding(el, name, events[name])
  }
}

export function withVaporModifiers<
  T extends (event: Event, ...args: unknown[]) => any,
>(fn: T, modifiers: string[]): T {
  return createInvoker(
    typeof fn === 'function'
      ? withDomModifiers(
          fn,
          modifiers as Parameters<typeof withDomModifiers>[1],
        )
      : fn,
  ) as T
}

export function withVaporKeys<T extends (event: KeyboardEvent) => any>(
  fn: T,
  modifiers: string[],
): T {
  return createInvoker(
    typeof fn === 'function'
      ? (withDomKeys(fn, modifiers) as EventHandler)
      : fn,
  ) as T
}

export function createInvoker(handler: MaybeEventHandlerValue): EventHandler {
  const i = currentInstance!
  return (...args: any[]) =>
    callWithAsyncErrorHandling(
      handler as EventHandlerValue,
      i,
      ErrorCodes.NATIVE_EVENT_HANDLER,
      args,
    )
}
