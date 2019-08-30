import { VNode } from './vnode'
import { ComponentInstance, LifecycleHooks } from './component'
import { warn, pushWarningContext, popWarningContext } from './warning'

// contexts where user provided function may be executed, in addition to
// lifecycle hooks.
export const enum UserExecutionContexts {
  RENDER_FUNCTION = 1,
  WATCH_CALLBACK,
  NATIVE_EVENT_HANDLER,
  COMPONENT_EVENT_HANDLER,
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
  [UserExecutionContexts.RENDER_FUNCTION]: 'render function',
  [UserExecutionContexts.WATCH_CALLBACK]: 'watcher callback',
  [UserExecutionContexts.NATIVE_EVENT_HANDLER]: 'native event handler',
  [UserExecutionContexts.COMPONENT_EVENT_HANDLER]: 'component event handler',
  [UserExecutionContexts.SCHEDULER]:
    'scheduler flush. This may be a Vue internals bug. ' +
    'Please open an issue at https://new-issue.vuejs.org/?repo=vuejs/vue'
}

type ErrorTypes = LifecycleHooks | UserExecutionContexts

export function callUserFnWithErrorHandling(
  fn: Function,
  instance: ComponentInstance | null,
  type: ErrorTypes,
  args?: any[]
) {
  let res: any
  try {
    res = args ? fn(...args) : fn()
    if (res && !res._isVue && typeof res.then === 'function') {
      ;(res as Promise<any>).catch(err => {
        handleError(err, instance, type)
      })
    }
  } catch (err) {
    handleError(err, instance, type)
  }
  return res
}

export function handleError(
  err: Error,
  instance: ComponentInstance | null,
  type: ErrorTypes
) {
  const contextVNode = instance ? instance.vnode : null
  let cur: ComponentInstance | null = instance && instance.parent
  while (cur) {
    const errorCapturedHooks = cur.ec
    if (errorCapturedHooks !== null) {
      for (let i = 0; i < errorCapturedHooks.length; i++) {
        if (errorCapturedHooks[i](err, type, contextVNode)) {
          return
        }
      }
    }
    cur = cur.parent
  }
  logError(err, type, contextVNode)
}

function logError(err: Error, type: ErrorTypes, contextVNode: VNode | null) {
  if (__DEV__) {
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
