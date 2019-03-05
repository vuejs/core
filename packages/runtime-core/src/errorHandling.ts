import { ComponentInstance } from './component'
import { warn, pushWarningContext, popWarningContext } from './warning'
import { VNode } from './vdom'
import { VNodeFlags } from './flags'
import { ComponentProxy } from './componentProxy'

export const enum ErrorTypes {
  BEFORE_CREATE = 1,
  CREATED,
  BEFORE_MOUNT,
  MOUNTED,
  BEFORE_UPDATE,
  UPDATED,
  BEFORE_UNMOUNT,
  UNMOUNTED,
  ACTIVATED,
  DEACTIVATED,
  ERROR_CAPTURED,
  RENDER,
  RENDER_TRACKED,
  RENDER_TRIGGERED,
  WATCH_CALLBACK,
  NATIVE_EVENT_HANDLER,
  COMPONENT_EVENT_HANDLER,
  SCHEDULER
}

const ErrorTypeStrings: Record<number, string> = {
  [ErrorTypes.BEFORE_CREATE]: 'in beforeCreate lifecycle hook',
  [ErrorTypes.CREATED]: 'in created lifecycle hook',
  [ErrorTypes.BEFORE_MOUNT]: 'in beforeMount lifecycle hook',
  [ErrorTypes.MOUNTED]: 'in mounted lifecycle hook',
  [ErrorTypes.BEFORE_UPDATE]: 'in beforeUpdate lifecycle hook',
  [ErrorTypes.UPDATED]: 'in updated lifecycle hook',
  [ErrorTypes.BEFORE_UNMOUNT]: 'in beforeUnmount lifecycle hook',
  [ErrorTypes.UNMOUNTED]: 'in unmounted lifecycle hook',
  [ErrorTypes.ACTIVATED]: 'in activated lifecycle hook',
  [ErrorTypes.DEACTIVATED]: 'in deactivated lifecycle hook',
  [ErrorTypes.ERROR_CAPTURED]: 'in errorCaptured lifecycle hook',
  [ErrorTypes.RENDER]: 'in render function',
  [ErrorTypes.RENDER_TRACKED]: 'in renderTracked debug hook',
  [ErrorTypes.RENDER_TRIGGERED]: 'in renderTriggered debug hook',
  [ErrorTypes.WATCH_CALLBACK]: 'in watcher callback',
  [ErrorTypes.NATIVE_EVENT_HANDLER]: 'in native event handler',
  [ErrorTypes.COMPONENT_EVENT_HANDLER]: 'in component event handler',
  [ErrorTypes.SCHEDULER]:
    'when flushing updates. This may be a Vue internals bug.'
}

export function callLifecycleHookWithHandler(
  hook: Function,
  instanceProxy: ComponentProxy,
  type: ErrorTypes,
  arg?: any
) {
  try {
    const res = hook.call(instanceProxy, arg)
    if (res && !res._isVue && typeof res.then === 'function') {
      ;(res as Promise<any>).catch(err => {
        handleError(err, instanceProxy._self, type)
      })
    }
  } catch (err) {
    handleError(err, instanceProxy._self, type)
  }
}

export function handleError(
  err: Error,
  instance: ComponentInstance | VNode | null,
  type: ErrorTypes
) {
  const isFunctional = instance && (instance as VNode)._isVNode
  const contextVNode =
    instance &&
    ((isFunctional
      ? instance
      : (instance as ComponentInstance).$parentVNode) as VNode | null)
  let cur: ComponentInstance | null = null
  if (isFunctional) {
    let vnode = instance as VNode | null
    while (vnode && !(vnode.flags & VNodeFlags.COMPONENT_STATEFUL)) {
      vnode = vnode.contextVNode
    }
    if (vnode) {
      cur = vnode.children as ComponentInstance
    }
  } else if (instance) {
    const parent = (instance as ComponentInstance).$parent
    cur = parent && parent._self
  }
  while (cur) {
    const handler = cur.errorCaptured
    if (handler) {
      try {
        const captured = handler.call(
          cur,
          err,
          type,
          isFunctional ? null : instance
        )
        if (captured) return
      } catch (err2) {
        logError(err2, ErrorTypes.ERROR_CAPTURED, contextVNode)
      }
    }
    cur = cur.$parent && cur.$parent._self
  }
  logError(err, type, contextVNode)
}

function logError(err: Error, type: ErrorTypes, contextVNode: VNode | null) {
  if (__DEV__) {
    const info = ErrorTypeStrings[type]
    if (contextVNode) {
      pushWarningContext(contextVNode)
    }
    if (/private field/.test(err.message)) {
      warn(
        `Private fields cannot be accessed directly on \`this\` in a component ` +
          `class because they cannot be tunneled through Proxies. ` +
          `Use \`this._self.#field\` instead.`
      )
    } else {
      warn(`Unhandled error${info ? ` ${info}` : ``}`)
    }
    console.error(err)
    if (contextVNode) {
      popWarningContext()
    }
  } else {
    throw err
  }
}
