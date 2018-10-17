import { isArray } from '@vue/shared'

export class EventEmitter {
  ctx: any
  events: { [event: string]: Function[] | null } = {}

  constructor(ctx: any) {
    this.ctx = ctx
  }

  // eventEmitter interface
  on(event: string, fn: Function) {
    if (isArray(event)) {
      for (let i = 0; i < event.length; i++) {
        this.on(event[i], fn)
      }
    } else {
      const { events } = this
      ;(events[event] || (events[event] = [])).push(fn)
    }
  }

  once(event: string, fn: Function) {
    const onceFn = (...args: any[]) => {
      this.off(event, onceFn)
      fn.apply(this, args)
    }
    ;(onceFn as any).fn = fn
    this.on(event, onceFn)
  }

  off(event?: string, fn?: Function) {
    if (!event && !fn) {
      this.events = {}
    } else if (isArray(event)) {
      for (let i = 0; i < event.length; i++) {
        this.off(event[i], fn)
      }
    } else if (!fn) {
      this.events[event as string] = null
    } else {
      const fns = this.events[event as string]
      if (fns) {
        for (let i = 0; i < fns.length; i++) {
          const f = fns[i]
          if (fn === f || fn === (f as any).fn) {
            fns.splice(i, 1)
            break
          }
        }
      }
    }
  }

  emit(name: string, ...payload: any[]) {
    const handlers = this.events[name]
    if (handlers) {
      invokeListeners(handlers, payload, this.ctx)
    }
  }
}

export function invokeListeners(
  value: Function | Function[],
  payload: any[],
  ctx: any = null
) {
  // TODO handle error
  if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i].call(ctx, ...payload)
    }
  } else {
    value.call(ctx, ...payload)
  }
}
