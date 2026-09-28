import { onEffectCleanup } from '@vue/reactivity'
import { isArray, toHandlerKey } from '@vue/shared'
import {
  ErrorCodes,
  callWithAsyncErrorHandling,
  currentInstance,
  parseEventName,
  withKeys as withDomKeys,
  withModifiers as withDomModifiers,
} from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  isApplyingFallthroughProps,
} from '../component'

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
  // the root's own props, its v-on object and the fallthrough attrs
  layers: MaybeEventHandlerValue[]
  handlers: EventHandler[]
  remove?: () => void
  fired?: boolean
}

export const enum ListenerLayer {
  OWN,
  EVENTS,
  ATTRS,
}

// a root's own `on*` binding and the fallthrough one are two layers on one
// element; both go through onRootListener
export function hasListenerLayers(el: Element & { $root?: any }): boolean {
  return (
    isApplyingFallthroughProps ||
    (!!el.$root && (currentInstance as VaporComponentInstance).hasFallthrough)
  )
}

/**
 * Like a vdom invoker, the layers share one native listener per key that runs
 * the own handlers first and then the fallthrough ones not already among them,
 * so re-binding either layer keeps that order. #15635
 */
export function onRootListener(
  el: Element & { $revt?: Record<string, RootListener> },
  key: string,
  value: MaybeEventHandlerValue,
  layer: ListenerLayer,
): void {
  const listeners = el.$revt || (el.$revt = Object.create(null))
  const listener =
    listeners[key] || (listeners[key] = { layers: [], handlers: [] })
  listener.layers[layer] = value
  syncRootListener(el, key, listener)
  onEffectCleanup(() => {
    listener.layers[layer] = null
    syncRootListener(el, key, listener)
  })
}

function syncRootListener(
  el: Element,
  key: string,
  listener: RootListener,
): void {
  // `$attrs` rebuilds its merged array on every read, so the handlers are
  // compared rather than the values
  const handlers: EventHandler[] = (listener.handlers = [])
  for (const value of listener.layers) {
    for (const fn of isArray(value) ? value : [value]) {
      if (fn && !handlers.includes(fn)) handlers.push(fn)
    }
  }

  if (!handlers.length) {
    if (listener.remove) {
      listener.remove()
      listener.remove = undefined
    }
  } else if (!listener.remove && !listener.fired) {
    const [event, options] = parseEventName(key)
    const i = currentInstance
    listener.remove = addEventListener(
      el,
      event,
      (e: Event) => {
        // #15378 the browser drops a once listener after this call
        if (options && (options as AddEventListenerOptions).once) {
          listener.fired = true
        }
        // a sync replaces the array, so this is a snapshot of the call
        const handlers = listener.handlers
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
  const layered = hasListenerLayers(el)
  for (const name in events) {
    if (layered) {
      // the key vdom's toHandlers(obj, true) gives an element listener, so a
      // fallthrough listener for the same event lands on the same entry
      onRootListener(
        el,
        /[A-Z]/.test(name) ? `on:${name}` : toHandlerKey(name),
        events[name],
        ListenerLayer.EVENTS,
      )
    } else {
      const [event, options] = parseEventName(`on:${name}`)
      onBinding(el, event, events[name], options)
    }
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
