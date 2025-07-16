import {
  type WatchOptions as BaseWatchOptions,
  type DebuggerOptions,
  EffectFlags,
  type ReactiveMarker,
  type WatchCallback,
  type WatchEffect,
  type WatchHandle,
  type WatchSource,
  WatcherEffect,
} from '@vue/reactivity'
import { type SchedulerJob, SchedulerJobFlags, queueJob } from './scheduler'
import { EMPTY_OBJ, NOOP, extend, isFunction, isString } from '@vue/shared'
import {
  type ComponentInternalInstance,
  type GenericComponentInstance,
  currentInstance,
  isInSSRComponentSetup,
  setCurrentInstance,
} from './component'
import { callWithAsyncErrorHandling } from './errorHandling'
import { queuePostRenderEffect } from './renderer'
import { warn } from './warning'
import type { ObjectWatchOptionItem } from './componentOptions'
import { useSSRContext } from './helpers/useSsrContext'

export type {
  WatchHandle,
  WatchStopHandle,
  WatchEffect,
  WatchSource,
  WatchCallback,
  OnCleanup,
} from '@vue/reactivity'

type MaybeUndefined<T, I> = I extends true ? T | undefined : T

type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? MaybeUndefined<V, Immediate>
    : T[K] extends object
      ? MaybeUndefined<T[K], Immediate>
      : never
}

export interface WatchEffectOptions extends DebuggerOptions {
  flush?: 'pre' | 'post' | 'sync'
}

export interface WatchOptions<Immediate = boolean> extends WatchEffectOptions {
  immediate?: Immediate
  deep?: boolean | number
  once?: boolean
}

// Simple effect.
export function watchEffect(
  effect: WatchEffect,
  options?: WatchEffectOptions,
): WatchHandle {
  return doWatch(effect, null, options)
}

export function watchPostEffect(
  effect: WatchEffect,
  options?: DebuggerOptions,
): WatchHandle {
  return doWatch(
    effect,
    null,
    __DEV__ ? extend({}, options as any, { flush: 'post' }) : { flush: 'post' },
  )
}

export function watchSyncEffect(
  effect: WatchEffect,
  options?: DebuggerOptions,
): WatchHandle {
  return doWatch(
    effect,
    null,
    __DEV__ ? extend({}, options as any, { flush: 'sync' }) : { flush: 'sync' },
  )
}

export type MultiWatchSources = (WatchSource<unknown> | object)[]

// overload: single source + cb
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// overload: reactive array or tuple of multiple sources + cb
export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false,
>(
  sources: readonly [...T] | T,
  cb: [T] extends [ReactiveMarker]
    ? WatchCallback<T, MaybeUndefined<T, Immediate>>
    : WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// overload: array of multiple sources + cb
export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false,
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// overload: watching reactive object w/ cb
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false,
>(
  source: T,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// implementation
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: WatchCallback,
  options?: WatchOptions<Immediate>,
): WatchHandle {
  if (__DEV__ && !isFunction(cb)) {
    warn(
      `\`watch(fn, options?)\` signature has been moved to a separate API. ` +
        `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
        `supports \`watch(source, cb, options?) signature.`,
    )
  }
  return doWatch(source as any, cb, options)
}

class RenderWatcherEffect extends WatcherEffect {
  job: SchedulerJob

  constructor(
    instance: GenericComponentInstance | null,
    source: WatchSource | WatchSource[] | WatchEffect | object,
    cb: WatchCallback | null,
    options: BaseWatchOptions,
    private flush: 'pre' | 'post' | 'sync',
  ) {
    super(source, cb, options)

    const job: SchedulerJob = () => {
      if (this.dirty) {
        this.run()
      }
    }
    // important: mark the job as a watcher callback so that scheduler knows
    // it is allowed to self-trigger (#1727)
    if (cb) {
      this.flags |= EffectFlags.ALLOW_RECURSE
      job.flags! |= SchedulerJobFlags.ALLOW_RECURSE
    }
    if (instance) {
      job.i = instance
    }
    this.job = job
  }

  notify(): void {
    const flags = this.flags
    if (!(flags & EffectFlags.PAUSED)) {
      const flush = this.flush
      const job = this.job
      if (flush === 'post') {
        queuePostRenderEffect(job, undefined, job.i ? job.i.suspense : null)
      } else if (flush === 'pre') {
        queueJob(job, job.i ? job.i.uid : undefined, true)
      } else {
        job()
      }
    }
  }
}

function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  options: WatchOptions = EMPTY_OBJ,
): WatchHandle {
  const { immediate, deep, flush = 'pre', once } = options

  if (__DEV__ && !cb) {
    if (immediate !== undefined) {
      warn(
        `watch() "immediate" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`,
      )
    }
    if (deep !== undefined) {
      warn(
        `watch() "deep" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`,
      )
    }
    if (once !== undefined) {
      warn(
        `watch() "once" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`,
      )
    }
  }

  const baseWatchOptions: BaseWatchOptions = extend({}, options)

  if (__DEV__) baseWatchOptions.onWarn = warn

  // immediate watcher or watchEffect
  const runsImmediately = (cb && immediate) || (!cb && flush !== 'post')
  let ssrCleanup: (() => void)[] | undefined
  if (__SSR__ && isInSSRComponentSetup) {
    if (flush === 'sync') {
      const ctx = useSSRContext()!
      ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = [])
    } else if (!runsImmediately) {
      const watchStopHandle = () => {}
      watchStopHandle.stop = NOOP
      watchStopHandle.resume = NOOP
      watchStopHandle.pause = NOOP
      return watchStopHandle
    }
  }

  const instance = currentInstance
  baseWatchOptions.call = (fn, type, args) =>
    callWithAsyncErrorHandling(fn, instance, type, args)

  const effect = new RenderWatcherEffect(
    instance,
    source,
    cb,
    baseWatchOptions,
    flush,
  )

  // initial run
  if (cb) {
    effect.run(true)
  } else if (flush === 'post') {
    queuePostRenderEffect(effect.job, undefined, instance && instance.suspense)
  } else {
    effect.run(true)
  }

  const stop = effect.stop.bind(effect) as WatchHandle
  stop.pause = effect.pause.bind(effect)
  stop.resume = effect.resume.bind(effect)
  stop.stop = stop

  if (__SSR__ && isInSSRComponentSetup) {
    if (ssrCleanup) {
      ssrCleanup.push(stop)
    } else if (runsImmediately) {
      stop()
    }
  }

  return stop
}

// this.$watch
export function instanceWatch(
  this: ComponentInternalInstance,
  source: string | Function,
  value: WatchCallback | ObjectWatchOptionItem,
  options?: WatchOptions,
): WatchHandle {
  const publicThis = this.proxy as any
  const getter = isString(source)
    ? source.includes('.')
      ? createPathGetter(publicThis, source)
      : () => publicThis[source]
    : source.bind(publicThis, publicThis)
  let cb
  if (isFunction(value)) {
    cb = value
  } else {
    cb = value.handler as Function
    options = value
  }
  const prev = setCurrentInstance(this)
  const res = doWatch(getter, cb.bind(publicThis), options)
  setCurrentInstance(...prev)
  return res
}

export function createPathGetter(ctx: any, path: string) {
  const segments = path.split('.')
  return (): any => {
    let cur = ctx
    for (let i = 0; i < segments.length && cur; i++) {
      cur = cur[segments[i]]
    }
    return cur
  }
}
