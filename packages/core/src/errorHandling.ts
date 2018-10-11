import { ComponentInstance } from './component'
import { warn } from './warning'
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
  COMPONENT_EVENT_HANDLER
}

const ErrorTypeStrings: Record<number, string> = {
  [ErrorTypes.BEFORE_CREATE]: 'beforeCreate lifecycle hook',
  [ErrorTypes.CREATED]: 'created lifecycle hook',
  [ErrorTypes.BEFORE_MOUNT]: 'beforeMount lifecycle hook',
  [ErrorTypes.MOUNTED]: 'mounted lifecycle hook',
  [ErrorTypes.BEFORE_UPDATE]: 'beforeUpdate lifecycle hook',
  [ErrorTypes.UPDATED]: 'updated lifecycle hook',
  [ErrorTypes.BEFORE_DESTROY]: 'beforeDestroy lifecycle hook',
  [ErrorTypes.DESTROYED]: 'destroyed lifecycle hook',
  [ErrorTypes.ERROR_CAPTURED]: 'errorCaptured lifecycle hook',
  [ErrorTypes.RENDER]: 'render function',
  [ErrorTypes.WATCH_CALLBACK]: 'watcher callback',
  [ErrorTypes.NATIVE_EVENT_HANDLER]: 'native event handler',
  [ErrorTypes.COMPONENT_EVENT_HANDLER]: 'component event handler'
}

export function handleError(
  err: Error,
  instance: ComponentInstance | VNode,
  type: ErrorTypes
) {
  const isFunctional = (instance as VNode)._isVNode
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
          isFunctional ? null : instance,
          isFunctional ? instance : (instance as ComponentInstance).$parentVNode
        )
        if (captured) return
      } catch (err2) {
        logError(err2, ErrorTypes.ERROR_CAPTURED)
      }
    }
    cur = cur.$parent
  }
  logError(err, type)
}

function logError(err: Error, type: ErrorTypes) {
  if (__DEV__) {
    const info = ErrorTypeStrings[type]
    warn(`Unhandled error${info ? ` in ${info}` : ``}`)
    console.error(err)
  } else {
    throw err
  }
}
