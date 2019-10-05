import { isArray } from '@vue/shared'
import {
  ComponentInternalInstance,
  callWithAsyncErrorHandling
} from '@vue/runtime-core'
import { ErrorCodes } from 'packages/runtime-core/src/errorHandling'

interface Invoker extends Function {
  value: EventValue
  lastUpdated?: number
}

type EventValue = (Function | Function[]) & {
  invoker?: Invoker | null
}

// Async edge case fix requires storing an event listener's attach timestamp.
let _getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res ( relative to page load) or low-res
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

export function patchEvent(
  el: Element,
  name: string,
  prevValue: EventValue | null,
  nextValue: EventValue | null,
  instance: ComponentInternalInstance | null = null
) {
  const invoker = prevValue && prevValue.invoker
  if (nextValue) {
    if (invoker) {
      ;(prevValue as EventValue).invoker = null
      invoker.value = nextValue
      nextValue.invoker = invoker
      invoker.lastUpdated = getNow()
    } else {
      el.addEventListener(name, createInvoker(nextValue, instance))
    }
  } else if (invoker) {
    el.removeEventListener(name, invoker as any)
  }
}

function createInvoker(value: any, instance: ComponentInternalInstance | null) {
  const invoker = ((e: Event) => {
    // async edge case #6566: inner click event triggers patch, event handler
    // attached to outer element during patch, and triggered again. This
    // happens because browsers fire microtask ticks between event propagation.
    // the solution is simple: we save the timestamp when a handler is attached,
    // and the handler would only fire if the event passed to it was fired
    // AFTER it was attached.
    if (e.timeStamp >= invoker.lastUpdated) {
      const args = [e]
      if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          callWithAsyncErrorHandling(
            value[i],
            instance,
            ErrorCodes.NATIVE_EVENT_HANDLER,
            args
          )
        }
      } else {
        callWithAsyncErrorHandling(
          value,
          instance,
          ErrorCodes.NATIVE_EVENT_HANDLER,
          args
        )
      }
    }
  }) as any
  invoker.value = value
  value.invoker = invoker
  invoker.lastUpdated = getNow()
  return invoker
}
