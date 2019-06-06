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
  UnwrapValue
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

// record effects created during a component's setup() so that they can be
// stopped when the component unmounts
function recordEffect(effect: ReactiveEffect) {
  if (currentInstance) {
    ;(currentInstance.effects || (currentInstance.effects = [])).push(effect)
  }
}

// a wrapped version of raw computed to tear it down at component unmount
export function computed<T, C = null>(
  getter: () => T,
  setter?: (v: T) => void
): ComputedValue<T> {
  const c = _computed(getter, setter)
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
  cb?: <V extends T>(
    newValue: V,
    oldValue: V,
    onInvalidate: (fn: () => void) => void
  ) => any | void,
  { lazy, flush, deep, onTrack, onTrigger }: WatchOptions = EMPTY_OBJ
): () => void {
  const scheduler =
    flush === 'sync' ? invoke : flush === 'pre' ? queueJob : queuePostFlushCb

  const baseGetter = isValue(source) ? () => source.value : source
  const getter = deep ? () => traverse(baseGetter()) : baseGetter

  let cleanup: any
  const registerCleanup = (fn: () => void) => {
    // TODO wrap the cleanup fn for error handling
    cleanup = runner.onStop = fn
  }

  let oldValue: any
  const applyCb = cb
    ? () => {
        const newValue = runner()
        if (deep || newValue !== oldValue) {
          // cleanup before running cb again
          if (cleanup) {
            cleanup()
          }
          // TODO handle error (including ASYNC)
          try {
            cb(newValue, oldValue, registerCleanup)
          } catch (e) {}
          oldValue = newValue
        }
      }
    : void 0

  const runner = effect(getter, {
    lazy: true,
    // so it runs before component update effects in pre flush mode
    computed: true,
    onTrack,
    onTrigger,
    scheduler: applyCb ? () => scheduler(applyCb) : void 0
  })

  if (!lazy) {
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
