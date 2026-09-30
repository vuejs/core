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
import { isApplyingFallthroughProps } from '../component'

type EventHandler = (...args: any[]) => any
export type EventHandlerValue = EventHandler | EventHandler[]
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

interface Invoker {
  own: MaybeEventHandlerValue
  attrs: MaybeEventHandlerValue
  handlers: EventHandler[] | null
  remove: (() => void) | undefined
  fired: boolean
}

/**
 * A dynamic listener keeps one native listener per key across effect re-runs,
 * like a vdom invoker. A root's own `on*` binding and the fallthrough one are
 * two layers of it: the own handlers run first, then the fallthrough ones not
 * already among them, so re-binding either layer keeps that order. #15635
 */
export function setListener(
  el: Element & { $vei?: Record<string, Invoker> },
  key: string,
  value: MaybeEventHandlerValue,
): void {
  const invokers = el.$vei || (el.$vei = {})
  const invoker =
    invokers[key] ||
    (invokers[key] = {
      own: null,
      attrs: null,
      handlers: null,
      remove: undefined,
      fired: false,
    })
  const layer = isApplyingFallthroughProps ? 'attrs' : 'own'
  invoker[layer] = value
  if (composeHandlers(invoker).length) {
    if (!invoker.remove && !invoker.fired) attachInvoker(el, key, invoker)
  } else {
    if (invoker.remove) {
      invoker.remove()
      invoker.remove = undefined
    }
    invoker.fired = false
  }
  // a re-run sets the layer again right away, so the native listener stays
  onEffectCleanup(() => {
    invoker[layer] = null
    invoker.handlers = null
  })
}

function composeHandlers(invoker: Invoker): EventHandler[] {
  const { own, attrs } = invoker
  const handlers: EventHandler[] = (invoker.handlers = [])
  if (isArray(own)) {
    for (const fn of own) if (fn) handlers.push(fn)
  } else if (own) {
    handlers.push(own)
  }
  if (attrs) {
    // `$attrs` rebuilds its merged array on every read, so the fallthrough
    // handlers are compared one by one against the own ones; mergeProps
    // compares values instead, so own `[a]` with attrs `[a, b]` runs `a` once
    // here and twice in vdom
    const ownCount = handlers.length
    for (const fn of isArray(attrs) ? attrs : [attrs]) {
      if (fn) {
        const at = handlers.indexOf(fn)
        if (at < 0 || at >= ownCount) handlers.push(fn)
      }
    }
  }
  return handlers
}

function attachInvoker(el: Element, key: string, invoker: Invoker): void {
  const [event, options] = parseEventName(key)
  const once = !!options && (options as AddEventListenerOptions).once
  const i = currentInstance
  invoker.remove = addEventListener(
    el,
    event,
    (e: Event) => {
      // #15378 the browser drops a once listener after this call
      if (once) invoker.fired = true
      // a sync replaces the array, so this is a snapshot of the call
      const handlers = invoker.handlers || composeHandlers(invoker)
      if (handlers.length > 1) {
        const originalStop = e.stopImmediatePropagation
        e.stopImmediatePropagation = () => {
          originalStop.call(e)
          ;(e as any)._stopped = true
        }
      }
      const args = [e]
      for (const handler of handlers) {
        if ((e as any)._stopped) break
        callWithAsyncErrorHandling(
          handler,
          i,
          ErrorCodes.NATIVE_EVENT_HANDLER,
          args,
        )
      }
    },
    options,
  )
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
