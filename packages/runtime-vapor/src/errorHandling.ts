// These codes originate from a file of the same name in runtime-core,
// duplicated during Vapor's early development to ensure its independence.
// The ultimate aim is to uncouple this replicated code and
// facilitate its shared use between two runtimes.

import type { ComponentInternalInstance } from './component'
import { isFunction, isPromise } from '@vue/shared'
import { warn } from './warning'
import { VaporLifecycleHooks } from './enums'
import { WatchErrorCodes, pauseTracking, resetTracking } from '@vue/reactivity'

// contexts where user provided function may be executed, in addition to
// lifecycle hooks.
export enum VaporErrorCodes {
  SETUP_FUNCTION,
  RENDER_FUNCTION,
  // The error codes for the watch have been transferred to the reactivity
  // package along with baseWatch to maintain code compatibility. Hence,
  // it is essential to keep these values unchanged.
  // WATCH_GETTER,
  // WATCH_CALLBACK,
  // WATCH_CLEANUP,
  NATIVE_EVENT_HANDLER = 5,
  COMPONENT_EVENT_HANDLER,
  VNODE_HOOK,
  DIRECTIVE_HOOK,
  TRANSITION_HOOK,
  APP_ERROR_HANDLER,
  APP_WARN_HANDLER,
  FUNCTION_REF,
  ASYNC_COMPONENT_LOADER,
  SCHEDULER,
}

export type ErrorTypes = VaporLifecycleHooks | VaporErrorCodes | WatchErrorCodes

export const ErrorTypeStrings: Record<ErrorTypes, string> = {
  // [VaporLifecycleHooks.SERVER_PREFETCH]: 'serverPrefetch hook',
  [VaporLifecycleHooks.BEFORE_MOUNT]: 'beforeMount hook',
  [VaporLifecycleHooks.MOUNTED]: 'mounted hook',
  [VaporLifecycleHooks.BEFORE_UPDATE]: 'beforeUpdate hook',
  [VaporLifecycleHooks.UPDATED]: 'updated',
  [VaporLifecycleHooks.BEFORE_UNMOUNT]: 'beforeUnmount hook',
  [VaporLifecycleHooks.UNMOUNTED]: 'unmounted hook',
  [VaporLifecycleHooks.ACTIVATED]: 'activated hook',
  [VaporLifecycleHooks.DEACTIVATED]: 'deactivated hook',
  [VaporLifecycleHooks.ERROR_CAPTURED]: 'errorCaptured hook',
  [VaporLifecycleHooks.RENDER_TRACKED]: 'renderTracked hook',
  [VaporLifecycleHooks.RENDER_TRIGGERED]: 'renderTriggered hook',
  [VaporErrorCodes.SETUP_FUNCTION]: 'setup function',
  [VaporErrorCodes.RENDER_FUNCTION]: 'render function',
  [WatchErrorCodes.WATCH_GETTER]: 'watcher getter',
  [WatchErrorCodes.WATCH_CALLBACK]: 'watcher callback',
  [WatchErrorCodes.WATCH_CLEANUP]: 'watcher cleanup function',
  [VaporErrorCodes.NATIVE_EVENT_HANDLER]: 'native event handler',
  [VaporErrorCodes.COMPONENT_EVENT_HANDLER]: 'component event handler',
  [VaporErrorCodes.VNODE_HOOK]: 'vnode hook',
  [VaporErrorCodes.DIRECTIVE_HOOK]: 'directive hook',
  [VaporErrorCodes.TRANSITION_HOOK]: 'transition hook',
  [VaporErrorCodes.APP_ERROR_HANDLER]: 'app errorHandler',
  [VaporErrorCodes.APP_WARN_HANDLER]: 'app warnHandler',
  [VaporErrorCodes.FUNCTION_REF]: 'ref function',
  [VaporErrorCodes.ASYNC_COMPONENT_LOADER]: 'async component loader',
  [VaporErrorCodes.SCHEDULER]:
    'scheduler flush. This is likely a Vue internals bug. ' +
    'Please open an issue at https://new-issue.vuejs.org/?repo=vuejs/core',
}

export function callWithErrorHandling(
  fn: Function,
  instance: ComponentInternalInstance | null,
  type: ErrorTypes,
  args?: unknown[],
): any {
  let res
  try {
    res = args ? fn(...args) : fn()
  } catch (err) {
    handleError(err, instance, type)
  }
  return res
}

export function callWithAsyncErrorHandling<F extends Function | Function[]>(
  fn: F,
  instance: ComponentInternalInstance | null,
  type: ErrorTypes,
  args?: unknown[],
): F extends Function ? any : any[] {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn, instance, type, args)
    if (res && isPromise(res)) {
      res.catch(err => {
        handleError(err, instance, type)
      })
    }
    return res
  }

  const values = []
  for (let i = 0; i < fn.length; i++) {
    values.push(callWithAsyncErrorHandling(fn[i], instance, type, args))
  }
  return values
}

export function handleError(
  err: unknown,
  instance: ComponentInternalInstance | null,
  type: ErrorTypes,
  throwInDev = true,
): void {
  if (instance) {
    let cur = instance.parent
    // in production the hook receives only the error code
    const errorInfo = __DEV__
      ? ErrorTypeStrings[type]
      : `https://vuejs.org/errors/#runtime-${type}`
    while (cur) {
      const errorCapturedHooks = 'ec' in cur ? cur.ec : null
      if (errorCapturedHooks) {
        for (let i = 0; i < errorCapturedHooks.length; i++) {
          if (errorCapturedHooks[i](err, instance, errorInfo) === false) {
            return
          }
        }
      }
      cur = cur.parent
    }

    // app-level handling
    const appErrorHandler = instance.appContext.config.errorHandler
    if (appErrorHandler) {
      pauseTracking()
      callWithErrorHandling(
        appErrorHandler,
        null,
        VaporErrorCodes.APP_ERROR_HANDLER,
        [err, instance, errorInfo],
      )
      resetTracking()
      return
    }
  }
  logError(err, type, throwInDev)
}

function logError(err: unknown, type: ErrorTypes, throwInDev = true) {
  if (__DEV__) {
    const info = ErrorTypeStrings[type]
    warn(`Unhandled error${info ? ` during execution of ${info}` : ``}`)
    // crash in dev by default so it's more noticeable
    if (throwInDev) {
      throw err
    } else if (!__TEST__) {
      console.error(err)
    }
  } else {
    // recover in prod to reduce the impact on end-user
    console.error(err)
  }
}
