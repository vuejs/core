import { NOOP, hyphenate, isArray, isFunction } from '@vue/shared'
import {
  type ComponentInternalInstance,
  ErrorCodes,
  callWithAsyncErrorHandling,
  warn,
} from '@vue/runtime-core'

interface Invoker extends EventListener {
  value: EventValue
  attached: number
}

type EventValue = Function | Function[]

export function addEventListener(
  el: Element,
  event: string,
  handler: EventListener,
  options?: EventListenerOptions,
): void {
  el.addEventListener(event, handler, options)
}

export function removeEventListener(
  el: Element,
  event: string,
  handler: EventListener,
  options?: EventListenerOptions,
): void {
  el.removeEventListener(event, handler, options)
}

const veiKey: unique symbol = Symbol('_vei')

export function patchEvent(
  el: Element & { [veiKey]?: Record<string, Invoker | undefined> },
  rawName: string,
  prevValue: EventValue | null,
  nextValue: EventValue | unknown,
  instance: ComponentInternalInstance | null = null,
): void {
  // vei = vue event invokers
  const invokers = el[veiKey] || (el[veiKey] = {})
  const existingInvoker = invokers[rawName]
  if (nextValue && existingInvoker) {
    // patch
    existingInvoker.value = __DEV__
      ? sanitizeEventValue(nextValue, rawName)
      : (nextValue as EventValue)
  } else {
    const [name, options] = parseName(rawName)
    if (nextValue) {
      // add
      const invoker = (invokers[rawName] = createInvoker(
        __DEV__
          ? sanitizeEventValue(nextValue, rawName)
          : (nextValue as EventValue),
        instance,
      ))
      addEventListener(el, name, invoker, options)
    } else if (existingInvoker) {
      // remove
      removeEventListener(el, name, existingInvoker, options)
      invokers[rawName] = undefined
    }
  }
}

const optionsModifierRE = /(?:Once|Passive|Capture)$/

function parseName(name: string): [string, EventListenerOptions | undefined] {
  let options: EventListenerOptions | undefined
  if (optionsModifierRE.test(name)) {
    options = {}
    let m
    while ((m = name.match(optionsModifierRE))) {
      name = name.slice(0, name.length - m[0].length)
      ;(options as any)[m[0].toLowerCase()] = true
    }
  }
  const event = name[2] === ':' ? name.slice(3) : hyphenate(name.slice(2))
  return [event, options]
}

// To avoid the overhead of repeatedly calling Date.now(), we cache
// and use the same timestamp for all event listeners attached in the same tick.
let cachedNow: number = 0
const p = /*@__PURE__*/ Promise.resolve()
const getNow = () =>
  cachedNow || (p.then(() => (cachedNow = 0)), (cachedNow = Date.now()))

function createInvoker(
  initialValue: EventValue,
  instance: ComponentInternalInstance | null,
) {
  const invoker: Invoker = (e: Event & { _vts?: number }) => {
    // async edge case vuejs/vue#6566
    // inner click event triggers patch, event handler
    // attached to outer element during patch, and triggered again. This
    // happens because browsers fire microtask ticks between event propagation.
    // this no longer happens for templates in Vue 3, but could still be
    // theoretically possible for hand-written render functions.
    // the solution: we save the timestamp when a handler is attached,
    // and also attach the timestamp to any event that was handled by vue
    // for the first time (to avoid inconsistent event timestamp implementations
    // or events fired from iframes, e.g. #2513)
    // The handler would only fire if the event passed to it was fired
    // AFTER it was attached.
    if (!e._vts) {
      e._vts = Date.now()
    } else if (e._vts <= invoker.attached) {
      return
    }
    callWithAsyncErrorHandling(
      patchStopImmediatePropagation(e, invoker.value),
      instance,
      ErrorCodes.NATIVE_EVENT_HANDLER,
      [e],
    )
  }
  invoker.value = initialValue
  invoker.attached = getNow()
  return invoker
}

function sanitizeEventValue(value: unknown, propName: string): EventValue {
  if (isFunction(value) || isArray(value)) {
    return value as EventValue
  }
  warn(
    `Wrong type passed as event handler to ${propName} - did you forget @ or : ` +
      `in front of your prop?\nExpected function or array of functions, received type ${typeof value}.`,
  )
  return NOOP
}

function patchStopImmediatePropagation(
  e: Event,
  value: EventValue,
): EventValue {
  if (isArray(value)) {
    const originalStop = e.stopImmediatePropagation
    e.stopImmediatePropagation = () => {
      originalStop.call(e)
      ;(e as any)._stopped = true
    }
    return (value as Function[]).map(
      fn => (e: Event) => !(e as any)._stopped && fn && fn(e),
    )
  } else {
    return value
  }
}
