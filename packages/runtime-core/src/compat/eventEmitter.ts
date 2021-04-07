import { isArray } from '@vue/shared'
import { ComponentInternalInstance } from '../component'
import { callWithAsyncErrorHandling, ErrorCodes } from '../errorHandling'
import { assertCompatEnabled } from './compatConfig'
import { DeprecationTypes } from './deprecations'

interface EventRegistry {
  [event: string]: Function[] | undefined
}

const eventRegistryMap = /*#__PURE__*/ new WeakMap<
  ComponentInternalInstance,
  EventRegistry
>()

export function getRegistry(
  instance: ComponentInternalInstance
): EventRegistry {
  let events = eventRegistryMap.get(instance)
  if (!events) {
    eventRegistryMap.set(instance, (events = Object.create(null)))
  }
  return events!
}

export function on(
  instance: ComponentInternalInstance,
  event: string | string[],
  fn: Function
) {
  if (isArray(event)) {
    event.forEach(e => on(instance, e, fn))
  } else {
    if (event.startsWith('hook:')) {
      assertCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS)
    } else {
      assertCompatEnabled(DeprecationTypes.INSTANCE_EVENT_EMITTER)
    }
    const events = getRegistry(instance)
    ;(events[event] || (events[event] = [])).push(fn)
  }
  return instance.proxy
}

export function once(
  instance: ComponentInternalInstance,
  event: string,
  fn: Function
) {
  const wrapped = (...args: any[]) => {
    off(instance, event, wrapped)
    fn.call(instance.proxy, ...args)
  }
  wrapped.fn = fn
  on(instance, event, wrapped)
  return instance.proxy
}

export function off(
  instance: ComponentInternalInstance,
  event?: string,
  fn?: Function
) {
  assertCompatEnabled(DeprecationTypes.INSTANCE_EVENT_EMITTER)
  const vm = instance.proxy
  // all
  if (!arguments.length) {
    eventRegistryMap.set(instance, Object.create(null))
    return vm
  }
  // array of events
  if (isArray(event)) {
    event.forEach(e => off(instance, e, fn))
    return vm
  }
  // specific event
  const events = getRegistry(instance)
  const cbs = events[event!]
  if (!cbs) {
    return vm
  }
  if (!fn) {
    events[event!] = undefined
    return vm
  }
  events[event!] = cbs.filter(cb => !(cb === fn || (cb as any).fn === fn))
  return vm
}

export function emit(
  instance: ComponentInternalInstance,
  event: string,
  ...args: any[]
) {
  const cbs = getRegistry(instance)[event]
  if (cbs) {
    callWithAsyncErrorHandling(
      cbs,
      instance,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args
    )
  }
  return instance.proxy
}
