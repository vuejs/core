import { ComponentInstance } from './component'

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
  RENDER_ERROR,
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
  [ErrorTypes.RENDER_ERROR]: 'renderError function',
  [ErrorTypes.WATCH_CALLBACK]: 'watcher callback',
  [ErrorTypes.NATIVE_EVENT_HANDLER]: 'native event handler',
  [ErrorTypes.COMPONENT_EVENT_HANDLER]: 'component event handler'
}

export function handleError(
  err: Error,
  instance: ComponentInstance,
  type: ErrorTypes
) {
  let cur = instance
  while (cur.$parent) {
    cur = cur.$parent
    const handler = cur.errorCaptured
    if (handler) {
      try {
        const captured = handler.call(cur, err, type, instance)
        if (captured) return
      } catch (err2) {
        logError(err2, ErrorTypes.ERROR_CAPTURED)
      }
    }
  }
  logError(err, type)
}

function logError(err: Error, type: ErrorTypes) {
  if (__DEV__) {
    const info = ErrorTypeStrings[type]
    console.warn(`Unhandled error${info ? ` in ${info}` : ``}:`)
    console.error(err)
  } else {
    throw err
  }
}
