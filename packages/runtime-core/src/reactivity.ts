export {
  value,
  isValue,
  observable,
  immutable,
  isObservable,
  isImmutable,
  unwrap,
  markImmutable,
  markNonReactive,
  effect,
  // types
  ReactiveEffect,
  ReactiveEffectOptions,
  DebuggerEvent,
  OperationTypes,
  Value,
  ComputedValue,
  UnwrapValues
} from '@vue/observer'

import {
  effect,
  stop,
  computed as _computed,
  isValue,
  Value,
  ComputedValue,
  ReactiveEffect,
  ReactiveEffectOptions
} from '@vue/observer'
import { currentInstance } from './component'
import { queueJob, queuePostFlushCb } from './scheduler'
import { EMPTY_OBJ, isObject, isArray } from '@vue/shared'

function recordEffect(effect: ReactiveEffect) {
  if (currentInstance) {
    ;(currentInstance.effects || (currentInstance.effects = [])).push(effect)
  }
}

// a wrapped version of raw computed to tear it down at component unmount
export function computed<T, C = null>(
  getter: (this: C, ctx: C) => T,
  context?: C
): ComputedValue<T> {
  const c = _computed(getter, context)
  recordEffect(c.effect)
  return c
}

export interface WatchOptions {
  lazy?: boolean
  flush?: 'pre' | 'post' | 'sync'
  deep?: boolean
  onTrack?: ReactiveEffectOptions['onTrack']
  onTrigger?: ReactiveEffectOptions['onTrigger']
}

const invoke = (fn: Function) => fn()

export function watch<T>(
  source: Value<T> | (() => T),
  cb?: <V extends T>(newValue: V, oldValue: V) => (() => void) | void,
  options: WatchOptions = EMPTY_OBJ
): () => void {
  const scheduler =
    options.flush === 'sync'
      ? invoke
      : options.flush === 'pre'
        ? queueJob
        : queuePostFlushCb

  const traverseIfDeep = (getter: Function) =>
    options.deep ? () => traverse(getter()) : getter
  const getter = isValue(source)
    ? traverseIfDeep(() => source.value)
    : traverseIfDeep(source)

  let oldValue: any
  const applyCb = cb
    ? () => {
        const newValue = runner()
        if (options.deep || newValue !== oldValue) {
          try {
            cb(newValue, oldValue)
          } catch (e) {
            // TODO handle error
            // handleError(e, instance, ErrorTypes.WATCH_CALLBACK)
          }
          oldValue = newValue
        }
      }
    : void 0

  const runner = effect(getter, {
    lazy: true,
    // so it runs before component update effects in pre flush mode
    computed: true,
    onTrack: options.onTrack,
    onTrigger: options.onTrigger,
    scheduler: applyCb ? () => scheduler(applyCb) : void 0
  })

  if (!options.lazy) {
    applyCb && scheduler(applyCb)
  } else {
    oldValue = runner()
  }

  recordEffect(runner)
  return () => {
    stop(runner)
  }
}

function traverse(value: any, seen: Set<any> = new Set()) {
  if (!isObject(value) || seen.has(value)) {
    return
  }
  seen.add(value)
  if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else if (value instanceof Map || value instanceof Set) {
    ;(value as any).forEach((v: any) => {
      traverse(v, seen)
    })
  } else {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
  return value
}
