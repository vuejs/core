const delegateRE = /^(?:click|dblclick|submit|(?:key|mouse|touch).*)$/

type EventValue = Function | Function[]
type TargetRef = { el: Element | Document }

export function patchEvent(
  el: Element,
  name: string,
  prevValue: EventValue | null,
  nextValue: EventValue | null
) {
  if (delegateRE.test(name)) {
    handleDelegatedEvent(el, name, nextValue)
  } else {
    handleNormalEvent(el, name, prevValue, nextValue)
  }
}

const eventCounts: Record<string, number> = {}
const attachedGlobalHandlers: Record<string, Function> = {}

export function handleDelegatedEvent(
  el: any,
  name: string,
  value: EventValue | null
) {
  const count = eventCounts[name]
  let store = el.__events
  if (value) {
    if (!count) {
      attachGlobalHandler(name)
    }
    if (!store) {
      store = el.__events = {}
    }
    if (!store[name]) {
      eventCounts[name]++
    }
    store[name] = value
  } else if (store && store[name]) {
    eventCounts[name]--
    store[name] = null
    if (count === 1) {
      removeGlobalHandler(name)
    }
  }
}

function attachGlobalHandler(name: string) {
  const handler = (attachedGlobalHandlers[name] = (e: Event) => {
    const { type } = e
    const isClick = type === 'click' || type === 'dblclick'
    if (isClick && (e as MouseEvent).button !== 0) {
      e.stopPropagation()
      return false
    }
    e.stopPropagation = stopPropagation
    const targetRef: TargetRef = { el: document }
    Object.defineProperty(e, 'currentTarget', {
      configurable: true,
      get() {
        return targetRef.el
      }
    })
    dispatchEvent(e, name, isClick, targetRef)
  })
  document.addEventListener(name, handler)
  eventCounts[name] = 0
}

function stopPropagation() {
  this.cancelBubble = true
  if (!this.immediatePropagationStopped) {
    this.stopImmediatePropagation()
  }
}

function dispatchEvent(
  e: Event,
  name: string,
  isClick: boolean,
  targetRef: TargetRef
) {
  let el = e.target as any
  while (el != null) {
    // Don't process clicks on disabled elements
    if (isClick && el.disabled) {
      break
    }
    const store = el.__events
    if (store) {
      const value = store[name]
      if (value) {
        targetRef.el = el
        invokeEvents(e, value)
        if (e.cancelBubble) {
          break
        }
      }
    }
    el = el.parentNode
  }
}

function invokeEvents(e: Event, value: EventValue) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i](e)
    }
  } else {
    value(e)
  }
}

function removeGlobalHandler(name: string) {
  document.removeEventListener(name, attachedGlobalHandlers[name] as any)
  eventCounts[name] = 0
}

function handleNormalEvent(el: Element, name: string, prev: any, next: any) {
  const invoker = prev && prev.invoker
  if (next) {
    if (invoker) {
      prev.invoker = null
      invoker.value = next
      next.invoker = invoker
    } else {
      el.addEventListener(name, createInvoker(next))
    }
  } else if (invoker) {
    el.removeEventListener(name, invoker)
  }
}

function createInvoker(value: any) {
  const invoker = ((e: Event) => {
    invokeEvents(e, invoker.value)
  }) as any
  invoker.value = value
  value.invoker = invoker
  return invoker
}
