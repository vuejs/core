import {
  effect,
  stop,
  isRef,
  Ref,
  ReactiveEffectOptions
} from '@vue/reactivity'
import { queueJob } from './scheduler'
import { EMPTY_OBJ, isObject, isArray, isFunction, isString } from '@vue/shared'
import { recordEffect } from './apiReactivity'
import {
  currentInstance,
  ComponentInternalInstance,
  currentSuspense
} from './component'
import {
  ErrorCodes,
  callWithErrorHandling,
  callWithAsyncErrorHandling
} from './errorHandling'
import { onBeforeUnmount } from './apiLifecycle'
import { queuePostRenderEffect } from './createRenderer'

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

export type CleanupRegistrator = (invalidate: () => void) => void

type SimpleEffect = (onCleanup: CleanupRegistrator) => void

const invoke = (fn: Function) => fn()

// overload #1: simple effect
export function watch(effect: SimpleEffect, options?: WatchOptions): StopHandle

// overload #2: single source + cb
export function watch<T>(
  source: WatcherSource<T>,
  cb: (newValue: T, oldValue: T, onCleanup: CleanupRegistrator) => any,
  options?: WatchOptions
): StopHandle

// overload #3: array of multiple sources + cb
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
  const instance = currentInstance
  const suspense = currentSuspense

  let getter: Function
  if (isArray(source)) {
    getter = () =>
      source.map(
        s =>
          isRef(s)
            ? s.value
            : callWithErrorHandling(s, instance, ErrorCodes.WATCH_GETTER)
      )
  } else if (isRef(source)) {
    getter = () => source.value
  } else if (cb) {
    // getter with cb
    getter = () =>
      callWithErrorHandling(source, instance, ErrorCodes.WATCH_GETTER)
  } else {
    // no cb -> simple effect
    getter = () => {
      if (instance && instance.isUnmounted) {
        return
      }
      if (cleanup) {
        cleanup()
      }
      return callWithErrorHandling(
        source,
        instance,
        ErrorCodes.WATCH_CALLBACK,
        [registerCleanup]
      )
    }
  }

  if (deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: Function
  const registerCleanup: CleanupRegistrator = (fn: () => void) => {
    // TODO wrap the cleanup fn for error handling
    cleanup = runner.onStop = () => {
      callWithErrorHandling(fn, instance, ErrorCodes.WATCH_CLEANUP)
    }
  }

  let oldValue = isArray(source) ? [] : undefined
  const applyCb = cb
    ? () => {
        if (instance && instance.isUnmounted) {
          return
        }
        const newValue = runner()
        if (deep || newValue !== oldValue) {
          // cleanup before running cb again
          if (cleanup) {
            cleanup()
          }
          callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
            newValue,
            oldValue,
            registerCleanup
          ])
          oldValue = newValue
        }
      }
    : void 0

  let scheduler: (job: () => any) => void
  if (flush === 'sync') {
    scheduler = invoke
  } else if (flush === 'pre') {
    scheduler = job => {
      if (!instance || instance.vnode.el != null) {
        queueJob(job)
      } else {
        // with 'pre' option, the first call must happen before
        // the component is mounted so it is called synchronously.
        job()
      }
    }
  } else {
    scheduler = job => {
      queuePostRenderEffect(job, suspense)
    }
  }

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

// this.$watch
export function instanceWatch(
  this: ComponentInternalInstance,
  source: string | Function,
  cb: Function,
  options?: WatchOptions
): () => void {
  const ctx = this.renderProxy as any
  const getter = isString(source) ? () => ctx[source] : source.bind(ctx)
  const stop = watch(getter, cb.bind(ctx), options)
  onBeforeUnmount(stop, this)
  return stop
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
  } else if (value instanceof Map) {
    value.forEach((v, key) => {
      // to register mutation dep for existing keys
      traverse(value.get(key), seen)
    })
  } else if (value instanceof Set) {
    value.forEach(v => {
      traverse(v, seen)
    })
  } else {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
  return value
}
