import { EMPTY_OBJ, NOOP } from './utils'
import { MountedComponent } from './component'
import { ComponentWatchOptions, WatchOptions } from './componentOptions'
import { autorun, stop } from '@vue/observer'
import { queueJob } from '@vue/scheduler'
import { handleError, ErrorTypes } from './errorHandling'

export function initializeWatch(
  instance: MountedComponent,
  options: ComponentWatchOptions | undefined
) {
  if (options !== void 0) {
    for (const key in options) {
      const opt = options[key]
      if (Array.isArray(opt)) {
        opt.forEach(o => setupWatcher(instance, key, o))
      } else if (typeof opt === 'function') {
        setupWatcher(instance, key, opt)
      } else if (typeof opt === 'string') {
        setupWatcher(instance, key, (instance as any)[opt])
      } else if (opt.handler) {
        setupWatcher(instance, key, opt.handler, opt)
      }
    }
  }
}

export function setupWatcher(
  instance: MountedComponent,
  keyOrFn: string | Function,
  cb: (newValue: any, oldValue: any) => void,
  options: WatchOptions = EMPTY_OBJ as WatchOptions
): () => void {
  const handles = instance._watchHandles || (instance._watchHandles = new Set())
  const proxy = instance.$proxy

  const rawGetter =
    typeof keyOrFn === 'string'
      ? parseDotPath(keyOrFn, proxy)
      : () => keyOrFn.call(proxy)

  if (__DEV__ && rawGetter === NOOP) {
    console.warn(
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
      oldValue = newValue
      try {
        cb.call(instance.$proxy, newValue, oldValue)
      } catch (e) {
        handleError(e, instance, ErrorTypes.WATCH_CALLBACK)
      }
    }
  }

  const runner = autorun(getter, {
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

export function teardownWatch(instance: MountedComponent) {
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
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return
  }
  seen.add(value)
  if (Array.isArray(value)) {
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
