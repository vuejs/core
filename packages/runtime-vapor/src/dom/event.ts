import { onEffectCleanup } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import {
  ErrorCodes,
  callWithAsyncErrorHandling,
  currentInstance,
  parseEventName,
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
  options?: AddEventListenerOptions,
): void {
  if (isArray(handler)) {
    handler.forEach(fn => on(el, event, fn, options))
  } else {
    if (!handler) return
    // no cleanup closure: static listeners live and die with the element
    el.addEventListener(event, createInvoker(handler), options)
  }
}

export function onBinding(
  el: Element,
  event: string,
  handler: EventHandlerValue,
  options?: AddEventListenerOptions,
): void {
  if (isArray(handler)) {
    handler.forEach(fn => onBinding(el, event, fn, options))
    return
  }
  if (!handler) return
  if (options && options.once) {
    // #15378 avoid re-registering invoked once listeners on effect re-runs
    const firedKey = `$evtonce_${options.capture ? 1 : 0}_${event}`
    if ((el as any)[firedKey]) return
    const invoker = handler
    handler = (...args: any[]) => {
      ;(el as any)[firedKey] = true
      return invoker(...args)
    }
  }
  const cleanup = addEventListener(el, event, createInvoker(handler), options)
  onEffectCleanup(cleanup)
}

interface RootListener {
  own?: MaybeEventHandlerValue
  attrs?: MaybeEventHandlerValue
  handlers: EventHandler[]
  remove?: () => void
  fired?: boolean
}

/**
 * A single root element receives `on*` props from both its own dynamic props
 * and the component's fallthrough attrs. Both sources share one native
 * listener per key so that own handlers always run first regardless of which
 * source re-binds, and a handler present in both runs once (same as
 * mergeProps: existing handlers are kept, incoming ones are appended unless
 * already present).
 */
export function onRootBinding(
  el: Element & { $rootEvts?: Record<string, RootListener> },
  key: string,
  handler: MaybeEventHandlerValue,
  isFallthrough: boolean,
): void {
  const listeners = el.$rootEvts || (el.$rootEvts = Object.create(null))
  const listener = listeners[key] || (listeners[key] = { handlers: [] })
  const source = isFallthrough ? 'attrs' : 'own'
  listener[source] = handler
  syncRootListener(el, key, listener)
  onEffectCleanup(() => {
    listener[source] = null
    syncRootListener(el, key, listener)
  })
}

function syncRootListener(el: Element, key: string, listener: RootListener) {
  const handlers: EventHandler[] = (listener.handlers = [])
  const add = (value: MaybeEventHandlerValue, dedupe: boolean) => {
    if (isArray(value)) {
      value.forEach(fn => add(fn, dedupe))
    } else if (value && !(dedupe && handlers.includes(value))) {
      handlers.push(value)
    }
  }
  add(listener.own, false)
  add(listener.attrs, true)

  if (!handlers.length) {
    if (listener.remove) {
      listener.remove()
      listener.remove = undefined
    }
  } else if (!listener.remove && !listener.fired) {
    const [event, options] = parseEventName(key)
    const once = options && (options as AddEventListenerOptions).once
    const i = currentInstance
    listener.remove = addEventListener(
      el,
      event,
      (e: Event) => {
        if (once) listener.fired = true
        const handlers = listener.handlers.slice()
        if (handlers.length > 1) {
          const originalStop = e.stopImmediatePropagation
          e.stopImmediatePropagation = () => {
            originalStop.call(e)
            ;(e as any)._stopped = true
          }
        }
        for (const handler of handlers) {
          if ((e as any)._stopped) break
          callWithAsyncErrorHandling(
            handler,
            i,
            ErrorCodes.NATIVE_EVENT_HANDLER,
            [e],
          )
        }
      },
      options,
    )
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
      } else if (!node.disabled) {
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
    const [event, options] = parseEventName(`on:${name}`)
    onBinding(el, event, events[name], options)
  }
}

export function withVaporModifiers<
  T extends (event: Event, ...args: unknown[]) => any,
>(fn: T | null | undefined, modifiers: string[]): T {
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
  fn: T | null | undefined,
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
