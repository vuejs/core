import {
  effect,
  stop,
  isRef,
  Ref,
  ReactiveEffectOptions
} from '@vue/reactivity'
import { queueJob, queuePostFlushCb } from './scheduler'
import { EMPTY_OBJ, isObject, isArray, isFunction } from '@vue/shared'
import { recordEffect } from './apiReactivity'

export interface WatchOptions {
  lazy?: boolean
  flush?: 'pre' | 'post' | 'sync'
  deep?: boolean
  onTrack?: ReactiveEffectOptions['onTrack']
  onTrigger?: ReactiveEffectOptions['onTrigger']
}

type StopHandle = () => void

type WatcherSource<T = any> = Ref<T> | (() => T)

type MapSources<T> = {
  [K in keyof T]: T[K] extends WatcherSource<infer V> ? V : never
}

type CleanupRegistrator = (invalidate: () => void) => void

type SimpleEffect = (onCleanup: CleanupRegistrator) => void

const invoke = (fn: Function) => fn()

export function watch(effect: SimpleEffect, options?: WatchOptions): StopHandle

export function watch<T>(
  source: WatcherSource<T>,
  cb: (newValue: T, oldValue: T, onCleanup: CleanupRegistrator) => any,
  options?: WatchOptions
): StopHandle

export function watch<T extends WatcherSource<unknown>[]>(
  sources: T,
  cb: (
    newValues: MapSources<T>,
    oldValues: MapSources<T>,
    onCleanup: CleanupRegistrator
  ) => any,
  options?: WatchOptions
): StopHandle

// implementation
export function watch(
  effectOrSource:
    | WatcherSource<unknown>
    | WatcherSource<unknown>[]
    | SimpleEffect,
  effectOrOptions?:
    | ((value: any, oldValue: any, onCleanup: CleanupRegistrator) => any)
    | WatchOptions,
  options?: WatchOptions
): StopHandle {
  if (isFunction(effectOrOptions)) {
    // effect callback as 2nd argument - this is a source watcher
    return doWatch(effectOrSource, effectOrOptions, options)
  } else {
    // 2nd argument is either missing or an options object
    // - this is a simple effect watcher
    return doWatch(effectOrSource, null, effectOrOptions)
  }
}

function doWatch(
  source: WatcherSource | WatcherSource[] | SimpleEffect,
  cb:
    | ((newValue: any, oldValue: any, onCleanup: CleanupRegistrator) => any)
    | null,
  { lazy, deep, flush, onTrack, onTrigger }: WatchOptions = EMPTY_OBJ
): StopHandle {
  const baseGetter = isArray(source)
    ? () => source.map(s => (isRef(s) ? s.value : s()))
    : isRef(source)
      ? () => source.value
      : () => source(registerCleanup)
  const getter = deep ? () => traverse(baseGetter()) : baseGetter

  let cleanup: any
  const registerCleanup: CleanupRegistrator = (fn: () => void) => {
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

  const scheduler =
    flush === 'sync' ? invoke : flush === 'pre' ? queueJob : queuePostFlushCb

  const runner = effect(getter, {
    lazy: true,
    // so it runs before component update effects in pre flush mode
    computed: true,
    onTrack,
    onTrigger,
    scheduler: applyCb ? () => scheduler(applyCb) : scheduler
  })

  if (!lazy) {
    if (applyCb) {
      scheduler(applyCb)
    } else {
      scheduler(runner)
    }
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
