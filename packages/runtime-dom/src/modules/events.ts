import { isArray } from '@vue/shared'
import {
  ComponentInternalInstance,
  callWithAsyncErrorHandling
} from '@vue/runtime-core'
import { ErrorCodes } from 'packages/runtime-core/src/errorHandling'
import { getNowInternal } from '@vue/shared'

interface Invoker extends EventListener {
  value: EventValue
  lastUpdated: number
}

type EventValue = (Function | Function[]) & {
  invoker?: Invoker | null
}

// To avoid the overhead of repeatedly calling performance.now(), we cache
// and use the same timestamp for all event listeners attached in the same tick.
let cachedNow: number = 0
const p = Promise.resolve()
const reset = () => {
  cachedNow = 0
}
const getNow = () =>
  cachedNow || (p.then(reset), (cachedNow = getNowInternal()))

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
    el.removeEventListener(name, invoker)
  }
}

function createInvoker(
  initialValue: any,
  instance: ComponentInternalInstance | null
) {
  const invoker: Invoker = (e: Event) => {
    // async edge case #6566: inner click event triggers patch, event handler
    // attached to outer element during patch, and triggered again. This
    // happens because browsers fire microtask ticks between event propagation.
    // the solution is simple: we save the timestamp when a handler is attached,
    // and the handler would only fire if the event passed to it was fired
    // AFTER it was attached.
    if (e.timeStamp >= invoker.lastUpdated) {
      const args = [e]
      const value = invoker.value
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
  }
  invoker.value = initialValue
  initialValue.invoker = invoker
  invoker.lastUpdated = getNow()
  return invoker
}
