import {
  BaseWatchErrorCodes,
  type BaseWatchOptions,
  baseWatch,
  getCurrentScope,
} from '@vue/reactivity'
import { NOOP, invokeArrayFns, remove } from '@vue/shared'
import { currentInstance } from './component'
import {
  createVaporRenderingScheduler,
  queuePostRenderEffect,
} from './scheduler'
import {
  callWithAsyncErrorHandling,
  handleError as handleErrorWithInstance,
} from './errorHandling'
import { warn } from './warning'
import { invokeDirectiveHook } from './directive'

type WatchStopHandle = () => void

export function renderEffect(effect: () => void): WatchStopHandle {
  return doWatch(effect)
}

export function renderWatch(
  source: any,
  cb: (value: any, oldValue: any) => void,
): WatchStopHandle {
  return doWatch(source as any, cb)
}

function doWatch(source: any, cb?: any): WatchStopHandle {
  const extendOptions: BaseWatchOptions = {}

  if (__DEV__) extendOptions.onWarn = warn

  // TODO: Life Cycle Hooks

  // TODO: SSR
  // if (__SSR__) {}

  if (__DEV__ && !currentInstance) {
    warn(
      `${cb ? 'renderWatch' : 'renderEffect'}()` +
        ' is an internal API and it can only be used inside render()',
    )
  }

  if (cb) {
    // watch
    cb = wrapEffectCallback(cb)
  } else {
    // effect
    source = wrapEffectCallback(source)
  }

  const instance =
    getCurrentScope() === currentInstance?.scope ? currentInstance : null

  extendOptions.onError = (err: unknown, type: BaseWatchErrorCodes) => {
    // callback error handling is in wrapEffectCallback
    if (type === BaseWatchErrorCodes.WATCH_CALLBACK) {
      throw err
    }
    handleErrorWithInstance(err, instance, type)
  }
  extendOptions.scheduler = createVaporRenderingScheduler(instance)

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

function wrapEffectCallback(callback: (...args: any[]) => any): Function {
  const instance = currentInstance!

  return (...args: any[]) => {
    // with lifecycle
    if (instance.isMounted) {
      const { bu, u, dirs } = instance
      // currentInstance.updating = true
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

      // run callback
      callWithAsyncErrorHandling(
        callback,
        instance,
        BaseWatchErrorCodes.WATCH_CALLBACK,
        args,
      )

      if (isFirstEffect) {
        if (dirs) {
          queuePostRenderEffect(() => {
            instance.isUpdating = false
            invokeDirectiveHook(instance, 'updated')
          })
        }
        // updated hook
        if (u) {
          queuePostRenderEffect(u)
        }
      }
    } else {
      // is not mounted
      callWithAsyncErrorHandling(
        callback,
        instance,
        BaseWatchErrorCodes.WATCH_CALLBACK,
        args,
      )
    }
  }
}
