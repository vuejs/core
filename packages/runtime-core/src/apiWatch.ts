import {
  type ComputedRef,
  type DebuggerOptions,
  type EffectScheduler,
  ReactiveEffect,
  ReactiveFlags,
  type Ref,
  getCurrentScope,
  isReactive,
  isRef,
  isShallow,
} from '@vue/reactivity'
import { type SchedulerJob, queueJob } from './scheduler'
import {
  EMPTY_OBJ,
  NOOP,
  extend,
  hasChanged,
  isArray,
  isFunction,
  isMap,
  isObject,
  isPlainObject,
  isSet,
  isString,
  remove,
} from '@vue/shared'
import {
  type ComponentInternalInstance,
  currentInstance,
  isInSSRComponentSetup,
  setCurrentInstance,
} from './component'
import {
  ErrorCodes,
  callWithAsyncErrorHandling,
  callWithErrorHandling,
} from './errorHandling'
import { queuePostRenderEffect } from './renderer'
import { warn } from './warning'
import { DeprecationTypes } from './compat/compatConfig'
import { checkCompatEnabled, isCompatEnabled } from './compat/compatConfig'
import type { ObjectWatchOptionItem } from './componentOptions'
import { useSSRContext } from './helpers/useSsrContext'

export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup,
) => any

type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? Immediate extends true
      ? V | undefined
      : V
    : T[K] extends object
      ? Immediate extends true
        ? T[K] | undefined
        : T[K]
      : never
}

type OnCleanup = (cleanupFn: () => void) => void

export interface WatchOptionsBase extends DebuggerOptions {
  flush?: 'pre' | 'post' | 'sync'
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate
  deep?: boolean
  once?: boolean
}

export type WatchStopHandle = () => void

// Simple effect.
export function watchEffect(
  effect: WatchEffect,
  options?: WatchOptionsBase,
): WatchStopHandle {
  return doWatch(effect, null, options)
}

export function watchPostEffect(
  effect: WatchEffect,
  options?: DebuggerOptions,
) {
  return doWatch(
    effect,
    null,
    __DEV__ ? extend({}, options as any, { flush: 'post' }) : { flush: 'post' },
  )
}

export function watchSyncEffect(
  effect: WatchEffect,
  options?: DebuggerOptions,
) {
  return doWatch(
    effect,
    null,
    __DEV__ ? extend({}, options as any, { flush: 'sync' }) : { flush: 'sync' },
  )
}

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

type MultiWatchSources = (WatchSource<unknown> | object)[]

// overload: single source + cb
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle

// overload: array of multiple sources + cb
export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false,
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle

// overload: multiple sources w/ `as const`
// watch([foo, bar] as const, () => {})
// somehow [...T] breaks when the type is readonly
export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false,
>(
  source: T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle

// overload: watching reactive object w/ cb
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false,
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle

// implementation
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>,
): WatchStopHandle {
  if (__DEV__ && !isFunction(cb)) {
    warn(
      `\`watch(fn, options?)\` signature has been moved to a separate API. ` +
        `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
        `supports \`watch(source, cb, options?) signature.`,
    )
  }
  return doWatch(source as any, cb, options)
}

/**
 * 创建一个监控器来监听响应式对象的变化。
 *
 * @param source 监听的源，可以是响应式对象、ref、函数或者数组。
 * @param cb 变化回调函数，如果提供此参数，则函数模式为watch(source, cb)，否则为watchEffect。
 * @param options 配置选项，包括immediate、deep、flush、once、onTrack和onTrigger。
 * @returns 返回一个函数，调用该函数可以停止监听。
 */
function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  {
    immediate,
    deep,
    flush,
    once,
    onTrack,
    onTrigger,
  }: WatchOptions = EMPTY_OBJ,
): WatchStopHandle {
  // 如果设置了回调函数和once选项，则在回调执行后自动取消监听
  if (cb && once) {
    const _cb = cb
    cb = (...args) => {
      _cb(...args)
      unwatch()
    }
  }

  // TODO remove in 3.5
  if (__DEV__ && deep !== void 0 && typeof deep === 'number') {
    warn(
      `watch() "deep" option with number value will be used as watch depth in future versions. ` +
        `Please use a boolean instead to avoid potential breakage.`,
    )
  }

  // 开发环境下的参数校验
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

  // 校验source的有效性
  const warnInvalidSource = (s: unknown) => {
    warn(
      `Invalid watch source: `,
      s,
      `A watch source can only be a getter/effect function, a ref, ` +
        `a reactive object, or an array of these types.`,
    )
  }

  // 获取当前实例
  const instance = currentInstance
  // 根据deep选项，定义如何处理source的获取
  const reactiveGetter = (source: object) =>
    deep === true
      ? source // traverse will happen in wrapped getter below
      : // for deep: false, only traverse root-level properties
        traverse(source, deep === false ? 1 : undefined)

  let getter: () => any
  let forceTrigger = false
  let isMultiSource = false

  /**
   * 根据提供的source对象的类型，定义并返回一个相应的getter函数和一个forceTrigger标志。
   * getter函数用于获取source的当前值，forceTrigger标志用于指示是否强制触发getter。
   * @param source 可以是Ref、Reactive、Array、Function或其他类型的值，代表需要被观察的目标。
   * @returns 返回一个包含getter和forceTrigger属性的对象。getter是一个函数，根据source类型有不同的实现逻辑；
   * forceTrigger是一个布尔值，用于指示是否应该强制触发getter的调用。
   */
  if (isRef(source)) {
    getter = () => source.value // 如果source是Ref，则getter返回Ref的当前值
    forceTrigger = isShallow(source) // 判断是否为浅层响应式，是则forceTrigger为true
  } else if (isReactive(source)) {
    getter = () => reactiveGetter(source) // 如果source是Reactive，getter调用reactiveGetter来获取值
    forceTrigger = true // 强制触发getter
  } else if (isArray(source)) {
    isMultiSource = true // 如果source是数组，标记为多源
    // 判断数组中是否有响应式或浅层响应式元素，有则forceTrigger为true
    forceTrigger = source.some(s => isReactive(s) || isShallow(s))
    getter = () =>
      source.map(s => {
        if (isRef(s)) {
          return s.value // 如果元素是Ref，返回其值
        } else if (isReactive(s)) {
          // 如果元素是Reactive，调用reactiveGetter获取其值
          return reactiveGetter(s)
        } else if (isFunction(s)) {
          // 如果元素是函数，安全地调用它
          return callWithErrorHandling(s, instance, ErrorCodes.WATCH_GETTER)
        } else {
          // 开发模式下，警告无效的source
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    if (cb) {
      // 如果提供了回调cb，getter调用source函数并处理错误 getter with cb
      getter = () =>
        callWithErrorHandling(source, instance, ErrorCodes.WATCH_GETTER)
    } else {
      // 未提供cb，getter调用source函数并处理异步错误 no cb -> simple effect
      getter = () => {
        if (cleanup) {
          cleanup() // 先执行清理函数
        }
        return callWithAsyncErrorHandling(
          source,
          instance,
          ErrorCodes.WATCH_CALLBACK,
          [onCleanup],
        )
      }
    }
  } else {
    getter = NOOP // 如果source类型不支持，getter设为NOOP
    __DEV__ && warnInvalidSource(source)
  }

  // 2.x数组变动兼容处理 2.x array mutation watch compat
  if (__COMPAT__ && cb && !deep) {
    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      if (
        isArray(val) &&
        checkCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance)
      ) {
        traverse(val)
      }
      return val
    }
  }

  // deep选项下的getter额外处理
  if (cb && deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  // 定义清理逻辑
  let cleanup: (() => void) | undefined
  let onCleanup: OnCleanup = (fn: () => void) => {
    cleanup = effect.onStop = () => {
      callWithErrorHandling(fn, instance, ErrorCodes.WATCH_CLEANUP)
      cleanup = effect.onStop = undefined
    }
  }

  // in SSR there is no need to setup an actual effect, and it should be noop
  // unless it's eager or sync flush
  let ssrCleanup: (() => void)[] | undefined
  // SSR环境下效果的特殊处理
  if (__SSR__ && isInSSRComponentSetup) {
    // we will also not call the invalidate callback (+ runner is not set up)
    onCleanup = NOOP
    if (!cb) {
      getter()
    } else if (immediate) {
      callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
        getter(),
        isMultiSource ? [] : undefined,
        onCleanup,
      ])
    }
    if (flush === 'sync') {
      const ctx = useSSRContext()!
      ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = [])
    } else {
      return NOOP
    }
  }

  // 初始化旧值
  let oldValue: any = isMultiSource
    ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
    : INITIAL_WATCHER_VALUE

  /**
   * 创建一个调度器任务（SchedulerJob），用于执行监视器逻辑。
   * 该函数无参数和返回值，但内部封装了条件判断、执行回调和清理逻辑。
   * 主要用于响应式系统的 watch 和 watchEffect 函数内部。
   */
  const job: SchedulerJob = () => {
    // 判断效果是否处于激活状态且标记为dirty，如果不是，则不执行任何操作
    if (!effect.active || !effect.dirty) {
      return
    }
    if (cb) {
      // 如果提供了回调函数cb，则按照watch的逻辑执行，先运行effect以获取新值
      // watch(source, cb)
      const newValue = effect.run()
      // 判断是否需要触发回调，基于是否设置了deep、forceTrigger，或新旧值发生了变化
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) => hasChanged(v, oldValue[i]))
          : hasChanged(newValue, oldValue)) ||
        (__COMPAT__ &&
          isArray(newValue) &&
          isCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance))
      ) {
        // 在再次运行回调前进行清理工作 cleanup before running cb again
        if (cleanup) {
          cleanup()
        }
        // 错误处理，带异步错误处理的回调调用
        callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
          newValue,
          // 当旧值首次改变时，传递undefined作为旧值 pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE
            ? undefined
            : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE
              ? []
              : oldValue,
          onCleanup,
        ])
        // 更新旧值为新值
        oldValue = newValue
      }
    } else {
      // 如果没有提供回调函数，则按照watchEffect的逻辑执行，仅仅运行effect watchEffect
      effect.run()
    }
  }

  // 允许job自触发。这是一个重要的标记，让调度器知道该任务是可以自我触发的
  // 这主要用于区分普通任务和watcher回调任务，确保watcher可以自我调用而不引起死循环
  // important: mark the job as a watcher callback so that scheduler knows
  // it is allowed to self-trigger (#1727)
  job.allowRecurse = !!cb

  // 根据flush选项设置调度器
  let scheduler: EffectScheduler
  // flush 执行策略，可为sync、post或pre，分别代表同步、后置和前置执行。
  if (flush === 'sync') {
    // 直接调用任务函数作为调度器
    scheduler = job as any // the scheduler function gets called directly
  } else if (flush === 'post') {
    // 使用post方式调度任务，将任务加入到后渲染队列中
    scheduler = () => queuePostRenderEffect(job, instance && instance.suspense)
  } else {
    // 默认采用前置执行策略 default: 'pre'
    job.pre = true
    // 为任务设置实例UID
    if (instance) job.id = instance.uid
    // 将任务加入到前置队列中
    scheduler = () => queueJob(job)
  }

  // 创建并初始化effect
  const effect = new ReactiveEffect(getter, NOOP, scheduler)

  // 获取当前作用域并注册unwatch函数
  const scope = getCurrentScope()
  const unwatch = () => {
    effect.stop()
    if (scope) {
      remove(scope.effects, effect)
    }
  }

  // 开发环境下的额外effect设置
  if (__DEV__) {
    effect.onTrack = onTrack
    effect.onTrigger = onTrigger
  }

  // 初始运行逻辑 initial run
  /**
   * 根据条件执行副作用函数。
   * @param cb - 是否存在回调函数，用于控制是否立即执行副作用。
   * @param immediate - 是否立即执行副作用。
   * @param flush - 执行时机，'post' 表示在渲染后执行。
   * @param effect - 副作用函数。
   * @param instance - 实例，可选，用于与 suspense 一起使用。
   */
  if (cb) {
    if (immediate) {
      job() // 立即执行 job 函数
    } else {
      oldValue = effect.run() // 延迟执行 effect 函数，并保存旧值
    }
  } else if (flush === 'post') {
    // 如果 flush 为 'post'，则将 effect 绑定到实例的 suspense 上，在渲染后执行
    queuePostRenderEffect(
      effect.run.bind(effect),
      instance && instance.suspense,
    )
  } else {
    // 其他情况下直接执行 effect 函数
    effect.run()
  }

  // SSR环境下的额外处理
  if (__SSR__ && ssrCleanup) ssrCleanup.push(unwatch)
  return unwatch
}

// this.$watch
export function instanceWatch(
  this: ComponentInternalInstance,
  source: string | Function,
  value: WatchCallback | ObjectWatchOptionItem,
  options?: WatchOptions,
): WatchStopHandle {
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
  const reset = setCurrentInstance(this)
  const res = doWatch(getter, cb.bind(publicThis), options)
  reset()
  return res
}

export function createPathGetter(ctx: any, path: string) {
  const segments = path.split('.')
  return () => {
    let cur = ctx
    for (let i = 0; i < segments.length && cur; i++) {
      cur = cur[segments[i]]
    }
    return cur
  }
}

/**
 * 遍历给定的值，递归地探索其结构。
 *
 * @param value 要遍历的初始值，可以是任意类型。
 * @param depth 指定遍历的深度，若未指定或为0，则无深度限制。
 * @param currentDepth 当前遍历的深度，内部使用，外部调用时不需要设置。
 * @param seen 已经遍历过的值的集合，防止循环引用，若未指定，则在函数内部初始化。
 * @returns 返回遍历后的值，可能与其输入值相同。
 */
export function traverse(
  value: unknown,
  depth?: number,
  currentDepth = 0,
  seen?: Set<unknown>,
) {
  // 如果不是对象或者对象中标记了跳过的，直接返回该值
  if (!isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
    return value
  }

  // 如果指定了深度且当前深度已达到限制，则返回当前值
  if (depth && depth > 0) {
    if (currentDepth >= depth) {
      return value
    }
    currentDepth++
  }

  // 如果未提供已遍历值的集合，则初始化
  seen = seen || new Set()
  // 如果已经遍历过当前值，则直接返回该值，防止循环引用
  if (seen.has(value)) {
    return value
  }
  seen.add(value)
  // 对不同类型的值进行不同的遍历处理
  if (isRef(value)) {
    // 如果是引用类型，则递归遍历其值
    traverse(value.value, depth, currentDepth, seen)
  } else if (isArray(value)) {
    // 如果是数组，则遍历每个元素
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, currentDepth, seen)
    }
  } else if (isSet(value) || isMap(value)) {
    // 如果是集合类型，则遍历每个元素
    value.forEach((v: any) => {
      traverse(v, depth, currentDepth, seen)
    })
  } else if (isPlainObject(value)) {
    // 如果是普通对象，则遍历每个属性的值
    for (const key in value) {
      traverse(value[key], depth, currentDepth, seen)
    }
  }
  return value
}
