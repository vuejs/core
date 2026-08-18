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

type RootEventBinding = [
  local: MaybeEventHandlerValue,
  inherited: MaybeEventHandlerValue,
  merged: MaybeEventHandlerValue,
  remove: () => void,
]

type RootEventElement = Element & {
  // Lazily allocated only when dynamic local/fallthrough root handlers share
  // one stable native listener.
  $evts?: Record<string, RootEventBinding>
}

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

function mergeEventHandlers(
  local: MaybeEventHandlerValue,
  inherited: MaybeEventHandlerValue,
): MaybeEventHandlerValue {
  if (!local) return inherited
  if (
    !inherited ||
    local === inherited ||
    (isArray(local) && local.includes(inherited as EventHandler))
  ) {
    return local
  }
  return ([] as EventHandler[]).concat(local as any, inherited as any)
}

function createRootEventInvoker(binding: RootEventBinding): EventHandler {
  const instance = currentInstance!
  return (event: Event) => {
    const handler = binding[2]
    if (isArray(handler)) {
      const originalStop = event.stopImmediatePropagation
      event.stopImmediatePropagation = () => {
        originalStop.call(event)
        ;(event as any)._stopped = true
      }
      const handlers = handler.slice()
      const args = [event]
      for (let i = 0; i < handlers.length; i++) {
        if ((event as any)._stopped) break
        const handler = handlers[i]
        if (handler) {
          callWithAsyncErrorHandling(
            handler,
            instance,
            ErrorCodes.NATIVE_EVENT_HANDLER,
            args,
          )
        }
      }
    } else if (handler) {
      callWithAsyncErrorHandling(
        handler,
        instance,
        ErrorCodes.NATIVE_EVENT_HANDLER,
        [event],
      )
    }
  }
}

export function onRootBinding(
  el: RootEventElement,
  rawName: string,
  event: string,
  handler: MaybeEventHandlerValue,
  options: AddEventListenerOptions | undefined,
  inherited: boolean,
): void {
  let events = el.$evts
  let binding = events && events[rawName]
  if (!binding) {
    if (!handler) return
    if (!events) events = el.$evts = Object.create(null)
    binding = events![rawName] = [undefined, undefined, undefined, undefined!]
    binding[3] = addEventListener(
      el,
      event,
      createRootEventInvoker(binding),
      options,
    )
  }

  // Keep the native listener stable across effect reruns, notably for `.once`.
  // setDynamicProps explicitly clears this slot when the key is removed.
  const index = inherited ? 1 : 0
  binding[index] = handler
  binding[2] = mergeEventHandlers(binding[0], binding[1])

  if (!binding[2]) {
    binding[3]()
    delete events![rawName]
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
    onBinding(el, name, events[name])
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
