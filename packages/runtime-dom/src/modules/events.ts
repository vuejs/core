import { isChrome } from '../ua'

interface Invoker extends Function {
  value: EventValue
  lastUpdated?: number
}

type EventValue = (Function | Function[]) & {
  invoker?: Invoker | null
}

export function patchEvent(
  el: Element,
  name: string,
  prevValue: EventValue | null,
  nextValue: EventValue | null
) {
  const invoker = prevValue && prevValue.invoker
  if (nextValue) {
    if (invoker) {
      ;(prevValue as EventValue).invoker = null
      invoker.value = nextValue
      nextValue.invoker = invoker
      if (isChrome) {
        invoker.lastUpdated = performance.now()
      }
    } else {
      el.addEventListener(name, createInvoker(nextValue))
    }
  } else if (invoker) {
    el.removeEventListener(name, invoker as any)
  }
}

function createInvoker(value: any) {
  const invoker = ((e: Event) => {
    invokeEvents(e, invoker.value, invoker.lastUpdated)
  }) as any
  invoker.value = value
  value.invoker = invoker
  if (isChrome) {
    invoker.lastUpdated = performance.now()
  }
  return invoker
}

function invokeEvents(e: Event, value: EventValue, lastUpdated: number) {
  // async edge case #6566: inner click event triggers patch, event handler
  // attached to outer element during patch, and triggered again. This only
  // happens in Chrome as it fires microtask ticks between event propagation.
  // the solution is simple: we save the timestamp when a handler is attached,
  // and the handler would only fire if the event passed to it was fired
  // AFTER it was attached.
  if (isChrome && e.timeStamp < lastUpdated) {
    return
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i](e)
    }
  } else {
    value(e)
  }
}
