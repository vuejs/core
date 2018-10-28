import { ComponentInstance } from './component'
import { warn, pushWarningContext, popWarningContext } from './warning'
import { VNode } from './vdom'
import { VNodeFlags } from './flags'

export const enum ErrorTypes {
  BEFORE_CREATE = 1,
  CREATED,
  BEFORE_MOUNT,
  MOUNTED,
  BEFORE_UPDATE,
  UPDATED,
  BEFORE_DESTROY,
  DESTROYED,
  ERROR_CAPTURED,
  RENDER,
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
  [ErrorTypes.BEFORE_DESTROY]: 'in beforeDestroy lifecycle hook',
  [ErrorTypes.DESTROYED]: 'in destroyed lifecycle hook',
  [ErrorTypes.ERROR_CAPTURED]: 'in errorCaptured lifecycle hook',
  [ErrorTypes.RENDER]: 'in render function',
  [ErrorTypes.WATCH_CALLBACK]: 'in watcher callback',
  [ErrorTypes.NATIVE_EVENT_HANDLER]: 'in native event handler',
  [ErrorTypes.COMPONENT_EVENT_HANDLER]: 'in component event handler',
  [ErrorTypes.SCHEDULER]:
    'when flushing updates. This may be a Vue internals bug.'
}

export function handleError(
  err: Error,
  instance: ComponentInstance | VNode,
  type: ErrorTypes
) {
  const isFunctional = (instance as VNode)._isVNode
  const contextVNode = (isFunctional
    ? instance
    : (instance as ComponentInstance).$parentVNode) as VNode | null
  let cur: ComponentInstance | null = null
  if (isFunctional) {
    let vnode = instance as VNode | null
    while (vnode && !(vnode.flags & VNodeFlags.COMPONENT_STATEFUL)) {
      vnode = vnode.contextVNode
    }
    if (vnode) {
      cur = vnode.children as ComponentInstance
    }
  } else {
    cur = (instance as ComponentInstance).$parent
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
    cur = cur.$parent
  }
  logError(err, type, contextVNode)
}

function logError(err: Error, type: ErrorTypes, contextVNode: VNode | null) {
  if (__DEV__) {
    const info = ErrorTypeStrings[type]
    if (contextVNode) {
      pushWarningContext(contextVNode)
    }
    warn(`Unhandled error${info ? ` ${info}` : ``}`)
    if (contextVNode) {
      popWarningContext()
    }
    console.error(err)
  } else {
    throw err
  }
}
