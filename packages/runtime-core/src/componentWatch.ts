import {
  EMPTY_OBJ,
  NOOP,
  isFunction,
  isArray,
  isString,
  isObject
} from '@vue/shared'
import { ComponentInstance } from './component'
import { ComponentWatchOptions, WatchOptions } from './componentOptions'
import { effect, stop } from '@vue/observer'
import { queueJob } from '@vue/scheduler'
import { handleError, ErrorTypes } from './errorHandling'
import { warn } from './warning'

export function initializeWatch(
  instance: ComponentInstance,
  options: ComponentWatchOptions | undefined
) {
  if (options !== void 0) {
    for (const key in options) {
      const opt = options[key]
      if (isArray(opt)) {
        opt.forEach(o => setupWatcher(instance, key, o))
      } else if (isFunction(opt)) {
        setupWatcher(instance, key, opt)
      } else if (isString(opt)) {
        setupWatcher(instance, key, (instance as any)[opt])
      } else if (opt.handler) {
        setupWatcher(instance, key, opt.handler, opt)
      }
    }
  }
}

export function setupWatcher(
  instance: ComponentInstance,
  keyOrFn: string | Function,
  cb: (newValue: any, oldValue: any) => void,
  options: WatchOptions = EMPTY_OBJ as WatchOptions
): () => void {
  const handles = instance._watchHandles || (instance._watchHandles = new Set())
  const proxy = instance.$proxy

  const rawGetter = isString(keyOrFn)
    ? parseDotPath(keyOrFn, proxy)
    : () => keyOrFn.call(proxy)

  if (__DEV__ && rawGetter === NOOP) {
    warn(
      `Failed watching expression: "${keyOrFn}". ` +
        `Watch expressions can only be dot-delimited paths. ` +
        `For more complex expressions, use $watch with a function instead.`
    )
  }

  const getter = options.deep ? () => traverse(rawGetter()) : rawGetter

  let oldValue: any

  const applyCb = () => {
    const newValue = runner()
    if (options.deep || newValue !== oldValue) {
      try {
        cb.call(instance.$proxy, newValue, oldValue)
      } catch (e) {
        handleError(e, instance, ErrorTypes.WATCH_CALLBACK)
      }
      oldValue = newValue
    }
  }

  const runner = effect(getter, {
    lazy: true,
    scheduler: options.sync
      ? applyCb
      : () => {
          // defer watch callback using the scheduler so that multiple mutations
          // result in one call only.
          queueJob(applyCb)
        }
  })

  oldValue = runner()
  handles.add(runner)

  if (options.immediate) {
    cb.call(instance.$proxy, oldValue, undefined)
  }

  return () => {
    stop(runner)
    handles.delete(runner)
  }
}

export function teardownWatch(instance: ComponentInstance) {
  if (instance._watchHandles !== null) {
    instance._watchHandles.forEach(stop)
  }
}

const bailRE = /[^\w.$]/

function parseDotPath(path: string, ctx: any): Function {
  if (bailRE.test(path)) {
    return NOOP
  }
  const segments = path.split('.')
  if (segments.length === 1) {
    return () => ctx[path]
  } else {
    return () => {
      let obj = ctx
      for (let i = 0; i < segments.length; i++) {
        if (!obj) return
        obj = obj[segments[i]]
      }
      return obj
    }
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
