import {
  type BaseWatchErrorCodes,
  type BaseWatchOptions,
  baseWatch,
  getCurrentScope,
} from '@vue/reactivity'
import { NOOP, remove } from '@vue/shared'
import { currentInstance } from './component'
import { createVaporRenderingScheduler } from './scheduler'
import { handleError as handleErrorWithInstance } from './errorHandling'
import { warn } from './warning'

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

  const instance =
    getCurrentScope() === currentInstance?.scope ? currentInstance : null

  extendOptions.onError = (err: unknown, type: BaseWatchErrorCodes) =>
    handleErrorWithInstance(err, instance, type)
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
