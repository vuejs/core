import {
  type BaseWatchErrorCodes,
  type BaseWatchMiddleware,
  type BaseWatchOptions,
  baseWatch,
} from '@vue/reactivity'
import { NOOP, extend, invokeArrayFns, remove } from '@vue/shared'
import {
  type ComponentInternalInstance,
  getCurrentInstance,
  setCurrentInstance,
} from './component'
import {
  createVaporRenderingScheduler,
  queuePostRenderEffect,
} from './scheduler'
import { handleError as handleErrorWithInstance } from './errorHandling'
import { warn } from './warning'
import { invokeDirectiveHook } from './directives'

interface RenderWatchOptions {
  immediate?: boolean
  deep?: boolean
  once?: boolean
}

type WatchStopHandle = () => void

export function renderEffect(effect: () => void): WatchStopHandle {
  return doWatch(effect)
}

export function renderWatch(
  source: any,
  cb: (value: any, oldValue: any) => void,
  options?: RenderWatchOptions,
): WatchStopHandle {
  return doWatch(source as any, cb, options)
}

function doWatch(
  source: any,
  cb?: any,
  options?: RenderWatchOptions,
): WatchStopHandle {
  const extendOptions: BaseWatchOptions =
    cb && options ? extend({}, options) : {}

  if (__DEV__) extendOptions.onWarn = warn

  // TODO: SSR
  // if (__SSR__) {}

  const instance = getCurrentInstance()
  extend(extendOptions, {
    onError: (err: unknown, type: BaseWatchErrorCodes) =>
      handleErrorWithInstance(err, instance, type),
    scheduler: createVaporRenderingScheduler(instance),
    middleware: createMiddleware(instance),
  })
  let effect = baseWatch(source, cb, extendOptions)

  const unwatch = !effect
    ? NOOP
    : () => {
        effect!.stop()
        if (instance && instance.scope) {
          remove(instance.scope.effects!, effect)
        }
      }

  return unwatch
}

const createMiddleware =
  (instance: ComponentInternalInstance | null): BaseWatchMiddleware =>
  next => {
    let value: unknown
    // with lifecycle
    if (instance && instance.isMounted) {
      const { bu, u, dirs } = instance
      // beforeUpdate hook
      const isFirstEffect = !instance.isUpdating
      if (isFirstEffect) {
        if (bu) {
          invokeArrayFns(bu)
        }
        if (dirs) {
          invokeDirectiveHook(instance, 'beforeUpdate')
        }
        instance.isUpdating = true
      }

      const reset = setCurrentInstance(instance)
      // run callback
      value = next()
      reset()

      if (isFirstEffect) {
        queuePostRenderEffect(() => {
          instance.isUpdating = false
          if (dirs) {
            invokeDirectiveHook(instance, 'updated')
          }
          // updated hook
          if (u) {
            queuePostRenderEffect(u)
          }
        })
      }
    } else {
      // is not mounted
      value = next()
    }
    return value
  }
