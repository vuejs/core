import { VNode } from './vnode'
import { ComponentInstance, LifecycleHooks } from './component'
import { warn, pushWarningContext, popWarningContext } from './warning'

// contexts where user provided function may be executed, in addition to
// lifecycle hooks.
export const enum ErrorTypes {
  SETUP_FUNCTION = 1,
  RENDER_FUNCTION,
  WATCH_GETTER,
  WATCH_CALLBACK,
  WATCH_CLEANUP,
  NATIVE_EVENT_HANDLER,
  COMPONENT_EVENT_HANDLER,
  DIRECTIVE_HOOK,
  SCHEDULER
}

export const ErrorTypeStrings: Record<number | string, string> = {
  [LifecycleHooks.BEFORE_CREATE]: 'beforeCreate hook',
  [LifecycleHooks.CREATED]: 'created hook',
  [LifecycleHooks.BEFORE_MOUNT]: 'beforeMount hook',
  [LifecycleHooks.MOUNTED]: 'mounted hook',
  [LifecycleHooks.BEFORE_UPDATE]: 'beforeUpdate hook',
  [LifecycleHooks.UPDATED]: 'updated',
  [LifecycleHooks.BEFORE_UNMOUNT]: 'beforeUnmount hook',
  [LifecycleHooks.UNMOUNTED]: 'unmounted hook',
  [LifecycleHooks.ACTIVATED]: 'activated hook',
  [LifecycleHooks.DEACTIVATED]: 'deactivated hook',
  [LifecycleHooks.ERROR_CAPTURED]: 'errorCaptured hook',
  [LifecycleHooks.RENDER_TRACKED]: 'renderTracked hook',
  [LifecycleHooks.RENDER_TRIGGERED]: 'renderTriggered hook',
  [ErrorTypes.SETUP_FUNCTION]: 'setup function',
  [ErrorTypes.RENDER_FUNCTION]: 'render function',
  [ErrorTypes.WATCH_GETTER]: 'watcher getter',
  [ErrorTypes.WATCH_CALLBACK]: 'watcher callback',
  [ErrorTypes.WATCH_CLEANUP]: 'watcher cleanup function',
  [ErrorTypes.NATIVE_EVENT_HANDLER]: 'native event handler',
  [ErrorTypes.COMPONENT_EVENT_HANDLER]: 'component event handler',
  [ErrorTypes.DIRECTIVE_HOOK]: 'directive hook',
  [ErrorTypes.SCHEDULER]:
    'scheduler flush. This may be a Vue internals bug. ' +
    'Please open an issue at https://new-issue.vuejs.org/?repo=vuejs/vue'
}

type AllErrorTypes = LifecycleHooks | ErrorTypes

export function callWithErrorHandling(
  fn: Function,
  instance: ComponentInstance | null,
  type: AllErrorTypes,
  args?: any[]
) {
  let res: any
  try {
    res = args ? fn(...args) : fn()
  } catch (err) {
    handleError(err, instance, type)
  }
  return res
}

export function callWithAsyncErrorHandling(
  fn: Function,
  instance: ComponentInstance | null,
  type: AllErrorTypes,
  args?: any[]
) {
  const res = callWithErrorHandling(fn, instance, type, args)
  if (res != null && !res._isVue && typeof res.then === 'function') {
    ;(res as Promise<any>).catch(err => {
      handleError(err, instance, type)
    })
  }
  return res
}

export function handleError(
  err: Error,
  instance: ComponentInstance | null,
  type: AllErrorTypes
) {
  const contextVNode = instance ? instance.vnode : null
  let cur: ComponentInstance | null = instance && instance.parent
  while (cur) {
    const errorCapturedHooks = cur.ec
    if (errorCapturedHooks !== null) {
      for (let i = 0; i < errorCapturedHooks.length; i++) {
        if (
          errorCapturedHooks[i](
            err,
            instance && instance.renderProxy,
            // in production the hook receives only the error code
            __DEV__ ? ErrorTypeStrings[type] : type
          )
        ) {
          return
        }
      }
    }
    cur = cur.parent
  }
  logError(err, type, contextVNode)
}

function logError(err: Error, type: AllErrorTypes, contextVNode: VNode | null) {
  // default behavior is crash in prod & test, recover in dev.
  // TODO we should probably make this configurable via `createApp`
  if (
    __DEV__ &&
    !(typeof process !== 'undefined' && process.env.NODE_ENV === 'test')
  ) {
    const info = ErrorTypeStrings[type]
    if (contextVNode) {
      pushWarningContext(contextVNode)
    }
    warn(`Unhandled error${info ? ` during execution of ${info}` : ``}`)
    console.error(err)
    if (contextVNode) {
      popWarningContext()
    }
  } else {
    throw err
  }
}
