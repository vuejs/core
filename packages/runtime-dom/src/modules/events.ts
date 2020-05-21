import { EMPTY_OBJ, isArray } from '@vue/shared'
import {
  ComponentInternalInstance,
  callWithAsyncErrorHandling
} from '@vue/runtime-core'
import { ErrorCodes } from 'packages/runtime-core/src/errorHandling'

interface Invoker extends EventListener {
  value: EventValue
  lastUpdated: number
}

type EventValue = (Function | Function[]) & {
  invoker?: Invoker | null
}

type EventValueWithOptions = {
  handler: EventValue
  options: AddEventListenerOptions
  invoker?: Invoker | null
}

// Async edge case fix requires storing an event listener's attach timestamp.
let _getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
if (
  typeof document !== 'undefined' &&
  _getNow() > document.createEvent('Event').timeStamp
) {
  // if the low-res timestamp which is bigger than the event timestamp
  // (which is evaluated AFTER) it means the event is using a hi-res timestamp,
  // and we need to use the hi-res version for event listeners as well.
  _getNow = () => performance.now()
}

// To avoid the overhead of repeatedly calling performance.now(), we cache
// and use the same timestamp for all event listeners attached in the same tick.
let cachedNow: number = 0
const p = Promise.resolve()
const reset = () => {
  cachedNow = 0
}
const getNow = () => cachedNow || (p.then(reset), (cachedNow = _getNow()))

export function addEventListener(
  el: Element,
  event: string,
  handler: EventListener,
  options?: EventListenerOptions
) {
  el.addEventListener(event, handler, options)
}

export function removeEventListener(
  el: Element,
  event: string,
  handler: EventListener,
  options?: EventListenerOptions
) {
  el.removeEventListener(event, handler, options)
}

export function patchEvent(
  el: Element,
  rawName: string,
  prevValue: EventValueWithOptions | EventValue | null,
  nextValue: EventValueWithOptions | EventValue | null,
  instance: ComponentInternalInstance | null = null
) {
  const name = rawName.slice(2).toLowerCase()
  const prevOptions = prevValue && 'options' in prevValue && prevValue.options
  const nextOptions = nextValue && 'options' in nextValue && nextValue.options
  const invoker = prevValue && prevValue.invoker
  const value =
    nextValue && 'handler' in nextValue ? nextValue.handler : nextValue

  if (prevOptions || nextOptions) {
    const prev = prevOptions || EMPTY_OBJ
    const next = nextOptions || EMPTY_OBJ
    if (
      prev.capture !== next.capture ||
      prev.passive !== next.passive ||
      prev.once !== next.once
    ) {
      if (invoker) {
        removeEventListener(el, name, invoker, prev)
      }
      if (nextValue && value) {
        const invoker = createInvoker(value, instance)
        nextValue.invoker = invoker
        addEventListener(el, name, invoker, next)
      }
      return
    }
  }

  if (nextValue && value) {
    if (invoker) {
      ;(prevValue as EventValue).invoker = null
      invoker.value = value
      nextValue.invoker = invoker
      invoker.lastUpdated = getNow()
    } else {
      addEventListener(
        el,
        name,
        createInvoker(value, instance),
        nextOptions || void 0
      )
    }
  } else if (invoker) {
    removeEventListener(el, name, invoker, prevOptions || void 0)
  }
}

function createInvoker(
  initialValue: EventValue,
  instance: ComponentInternalInstance | null
) {
  const invoker: Invoker = (e: Event) => {
    // async edge case #6566: inner click event triggers patch, event handler
    // attached to outer element during patch, and triggered again. This
    // happens because browsers fire microtask ticks between event propagation.
    // the solution is simple: we save the timestamp when a handler is attached,
    // and the handler would only fire if the event passed to it was fired
    // AFTER it was attached.
    if (e.timeStamp >= invoker.lastUpdated - 1) {
      callWithAsyncErrorHandling(
        patchStopImmediatePropagation(e, invoker.value),
        instance,
        ErrorCodes.NATIVE_EVENT_HANDLER,
        [e]
      )
    }
  }
  invoker.value = initialValue
  initialValue.invoker = invoker
  invoker.lastUpdated = getNow()
  return invoker
}

function patchStopImmediatePropagation(
  e: Event,
  value: EventValue
): EventValue {
  if (isArray(value)) {
    const originalStop = e.stopImmediatePropagation
    e.stopImmediatePropagation = () => {
      originalStop.call(e)
      ;(e as any)._stopped = true
    }
    return value.map(fn => (e: Event) => !(e as any)._stopped && fn(e))
  } else {
    return value
  }
}
